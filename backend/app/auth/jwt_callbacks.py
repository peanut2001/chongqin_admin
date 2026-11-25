"""JWT 回调：每次请求都从数据库加载用户并校验状态与令牌版本，角色以数据库为准。"""

import uuid

from flask import jsonify

from app.extensions import db, jwt
from app.models import RevokedToken, User


@jwt.user_lookup_loader
def load_user(_header, payload):
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    return db.session.get(User, user_id)


@jwt.token_in_blocklist_loader
def is_revoked(_header, payload) -> bool:
    if payload.get("type") == "refresh":
        return db.session.get(RevokedToken, payload["jti"]) is not None
    return False


def _err(status: int, code: str, title: str):
    return jsonify({"title": title, "code": code}), status


@jwt.expired_token_loader
def expired(_header, _payload):
    return _err(401, "token_expired", "登录已过期，请重新登录。")


@jwt.invalid_token_loader
def invalid(_reason):
    return _err(401, "token_invalid", "登录状态无效，请重新登录。")


@jwt.unauthorized_loader
def missing(_reason):
    return _err(401, "unauthorized", "请先登录。")


@jwt.revoked_token_loader
def revoked(_header, _payload):
    return _err(401, "token_revoked", "登录状态已失效，请重新登录。")


@jwt.user_lookup_error_loader
def user_missing(_header, _payload):
    return _err(401, "user_not_found", "账号不存在，请重新登录。")
