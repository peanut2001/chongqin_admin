"""上传文件的校验、存储与安全响应头。

- 类型由文件头部字节判断（不信任扩展名与浏览器提供的 MIME）；
- 存储路径由服务端生成（kind/uuid），不使用用户文件名；
- JPEG 重新编码以去除 EXIF（医学影像照片可能带有元数据）；GIF/WebP/PNG 保留原始字节（保留动画）；
- SVG 仅用于头像，响应时加 CSP sandbox + attachment，避免被当作页面执行脚本。
"""

import hashlib
import io
import re
import uuid
from pathlib import Path

from flask import Response, current_app, send_file
from PIL import Image, ImageOps

from app.errors import ApiError
from app.extensions import db
from app.models import Upload

RASTER_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
SVG = "image/svg+xml"

_SVG_PREFIX = re.compile(
    rb"^\s*(<\?xml[^>]*\?>\s*)?(<!--.*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?(<!--.*?-->\s*)*<svg[\s>]",
    re.IGNORECASE | re.DOTALL,
)


def sniff(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    head = data[:4096].lstrip(b"\xef\xbb\xbf")
    if _SVG_PREFIX.match(head):
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return None
        return SVG
    return None


def _invalid(message: str) -> ApiError:
    return ApiError(422, "invalid_file", message, {"file": message})


def save_upload(owner_id: uuid.UUID, kind: str, file_storage, *, max_bytes: int, allow_svg: bool) -> Upload:
    if file_storage is None:
        raise _invalid("请选择要上传的文件。")
    data = file_storage.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ApiError(413, "file_too_large", f"文件不能超过 {max_bytes // (1024 * 1024)}MB。")
    if not data:
        raise _invalid("文件为空。")

    content_type = sniff(data)
    allowed = RASTER_TYPES | ({SVG} if allow_svg else set())
    if content_type not in allowed:
        formats = "SVG、GIF、PNG、JPG、WebP" if allow_svg else "PNG、JPG、GIF、WebP"
        raise _invalid(f"仅支持 {formats} 格式的图片。")

    width = height = None
    if content_type in RASTER_TYPES:
        try:
            with Image.open(io.BytesIO(data)) as im:
                im.verify()
            with Image.open(io.BytesIO(data)) as im:
                width, height = im.size
                if content_type == "image/jpeg":
                    # 去除 EXIF（含拍摄设备、地理位置等），同时按 EXIF 方向转正
                    out = io.BytesIO()
                    ImageOps.exif_transpose(im).convert("RGB").save(out, "JPEG", quality=92)
                    data = out.getvalue()
        except Exception as exc:
            raise _invalid("图片文件已损坏或无法识别。") from exc

    upload_id = uuid.uuid4()
    storage_key = f"{kind}/{upload_id}"
    path = Path(current_app.config["UPLOAD_DIR"]) / storage_key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

    upload = Upload(
        id=upload_id,
        owner_id=owner_id,
        kind=kind,
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        width=width,
        height=height,
        original_name=(file_storage.filename or "")[:200] or None,
    )
    db.session.add(upload)
    return upload


def delete_upload(upload: Upload) -> None:
    path = Path(current_app.config["UPLOAD_DIR"]) / upload.storage_key
    path.unlink(missing_ok=True)
    db.session.delete(upload)


def send_upload(upload: Upload, *, cache_seconds: int) -> Response:
    path = Path(current_app.config["UPLOAD_DIR"]) / upload.storage_key
    if not path.is_file():
        raise ApiError(404, "not_found", "文件不存在。")
    resp = send_file(path, mimetype=upload.content_type, max_age=cache_seconds)
    apply_safe_headers(resp, upload.content_type)
    return resp


def apply_safe_headers(resp: Response, content_type: str) -> Response:
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"
    )
    if content_type == SVG:
        # <img> 仍可正常显示；直接打开链接时作为下载，而不是在站点源下渲染执行
        resp.headers["Content-Disposition"] = 'attachment; filename="image.svg"'
    return resp
