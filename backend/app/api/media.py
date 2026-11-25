"""媒体文件。<img> 无法携带 Authorization 头，因此：
- 头像：凭不可猜测的上传 id 公开访问（换头像即换 id，可长期缓存）；
- 病例图片：开放获取内容，凭不透明 id 公开访问，地址中不含病例编号；
- 题目配图：签名地址，与病例库中的地址不同，无法据此反查病例；
- AI 判读上传图片：签名地址，1 小时内有效。
"""

from pathlib import Path

from flask import Blueprint, current_app, send_from_directory
from sqlalchemy import select

from app.errors import ApiError, not_found
from app.extensions import db
from app.models import CaseImage, QuestionImage, Upload
from app.services import media, signing
from app.services.users import parse_uuid

bp = Blueprint("media", __name__)

YEAR = 365 * 24 * 3600


@bp.get("/media/avatars/<upload_id>")
def avatar(upload_id: str):
    uid = parse_uuid(upload_id)
    upload = db.session.get(Upload, uid) if uid else None
    if upload is None or upload.kind != "avatar":
        raise not_found("头像")
    return media.send_upload(upload, cache_seconds=YEAR)


def _send_case_image(image: CaseImage | None):
    if image is None:
        raise not_found("图片")
    root = Path(current_app.config["CONTENT_DIR"]) / "case-images"
    resp = send_from_directory(root, image.storage_key, max_age=YEAR)
    resp.headers["Cache-Control"] = f"public, max-age={YEAR}, immutable"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@bp.get("/media/case-images/<image_id>")
def case_image(image_id: str):
    uid = parse_uuid(image_id)
    return _send_case_image(db.session.get(CaseImage, uid) if uid else None)


@bp.get("/media/question-images/<token>")
def question_image(token: str):
    # 只在题目实际用到的配图（百余张）中匹配，逐个计算 HMAC 的开销可以忽略
    candidates = db.session.scalars(select(QuestionImage.case_image_id).distinct())
    uid = signing.match_question_image_token(token, candidates)
    return _send_case_image(db.session.get(CaseImage, uid) if uid else None)


@bp.get("/media/uploads/<token>")
def upload_file(token: str):
    uid = signing.read_upload_token(token)
    if uid is None:
        raise ApiError(403, "link_expired", "图片链接无效或已过期，请刷新页面。")
    upload = db.session.get(Upload, uid)
    if upload is None:
        raise not_found("图片")
    return media.send_upload(upload, cache_seconds=3600)
