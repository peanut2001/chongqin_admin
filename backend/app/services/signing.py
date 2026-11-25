"""签名链接。

- 题目配图：与病例库里是同一张图片，但对外使用不同的不透明地址（图片 id 的 HMAC），
  学生无法通过比对图片地址反查出题目对应的病例（从而得知答案）。
  注意不能用 itsdangerous 的签名串：它只签名不加密，载荷可直接 base64 解码出图片 id。
- AI 判读上传图片：私有文件，签名地址 1 小时内有效。
"""

import hashlib
import hmac
import re
import uuid
from collections.abc import Iterable

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

QUESTION_IMAGE_TOKEN_RE = re.compile(r"[0-9a-f]{32}")


def _key() -> str:
    return current_app.config["MEDIA_SIGNING_KEY"]


def question_image_token(case_image_id: uuid.UUID) -> str:
    """不可逆的不透明 token：HMAC-SHA256(密钥, 图片 id) 的前 128 位。"""
    msg = f"question-image:{case_image_id}".encode()
    return hmac.new(_key().encode(), msg, hashlib.sha256).hexdigest()[:32]


def match_question_image_token(token: str, candidates: Iterable[uuid.UUID]) -> uuid.UUID | None:
    """在候选图片（题目用到的配图）中找出 token 对应的那一张。"""
    if not QUESTION_IMAGE_TOKEN_RE.fullmatch(token):
        return None
    for image_id in candidates:
        if hmac.compare_digest(question_image_token(image_id), token):
            return image_id
    return None


def upload_url(upload_id: uuid.UUID) -> str:
    token = URLSafeTimedSerializer(_key(), salt="upload").dumps(str(upload_id))
    return f"/api/media/uploads/{token}"


def read_upload_token(token: str) -> uuid.UUID | None:
    try:
        value = URLSafeTimedSerializer(_key(), salt="upload").loads(
            token, max_age=current_app.config["SIGNED_URL_MAX_AGE"]
        )
        return uuid.UUID(value)
    except (BadSignature, SignatureExpired, ValueError):
        return None
