"""当前用户：个人资料、修改密码、头像。"""

from flask import Blueprint, current_app, request
from pydantic import Field

from app.api.auth import _session_response
from app.auth.decorators import auth_required, me
from app.errors import ApiError
from app.extensions import db
from app.schemas import CamelModel, parse_body
from app.serializers import auth_user, user_full
from app.services import audit, media
from app.services.passwords import hash_password, verify_password

bp = Blueprint("me", __name__)


class ProfileUpdate(CamelModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    phone_number: str | None = Field(default=None, max_length=30)


class PasswordChange(CamelModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


def _profile(user):
    return {**user_full(user), "authUser": auth_user(user)}


@bp.get("/me")
@auth_required()
def get_me():
    return _profile(me())


@bp.patch("/me")
@auth_required()
def update_me():
    user = me()
    for key, value in parse_body(ProfileUpdate).model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.session.commit()
    return _profile(user)


@bp.post("/me/password")
@auth_required()
def change_password():
    user = me()
    body = parse_body(PasswordChange)
    if not verify_password(user.password_hash, body.current_password):
        raise ApiError(
            422, "validation_error", "当前密码不正确。", {"currentPassword": "当前密码不正确。"}
        )
    if body.current_password == body.new_password:
        raise ApiError(
            422, "validation_error", "新密码不能与当前密码相同。", {"newPassword": "新密码不能与当前密码相同。"}
        )
    if not any(c.islower() for c in body.new_password) or not any(c.isdigit() for c in body.new_password):
        raise ApiError(
            422, "validation_error", "密码需包含小写字母和数字。", {"newPassword": "密码需包含小写字母和数字。"}
        )
    user.password_hash = hash_password(body.new_password)
    # 其他设备上的登录全部失效；当前会话立即换发新令牌，不必重新登录
    user.token_version += 1
    audit.log("user.password_change", user.id, "user", str(user.id))
    db.session.commit()
    return _session_response(user)


@bp.put("/me/avatar")
@auth_required()
def upload_avatar():
    user = me()
    upload = media.save_upload(
        user.id,
        "avatar",
        request.files.get("file"),
        max_bytes=current_app.config["AVATAR_MAX_BYTES"],
        allow_svg=True,
    )
    old = user.avatar
    db.session.flush()
    user.avatar_upload_id = upload.id
    if old is not None:
        media.delete_upload(old)
    db.session.commit()
    return _profile(user)


@bp.delete("/me/avatar")
@auth_required()
def delete_avatar():
    user = me()
    old = user.avatar
    user.avatar_upload_id = None
    if old is not None:
        media.delete_upload(old)
    db.session.commit()
    return _profile(user)
