"""@auth_required(*roles)：登录校验 + 账号状态 + 令牌版本 + 角色。角色一律以数据库为准。"""

from functools import wraps

from flask_jwt_extended import current_user, get_jwt, verify_jwt_in_request

from app.errors import ApiError, forbidden
from app.models import User

STATUS_MESSAGES = {
    "inactive": "该账号未激活，请联系管理员。",
    "invited": "该账号尚未接受邀请，请联系管理员。",
    "suspended": "该账号已被停用，请联系管理员。",
}


def check_user_usable(user: User | None, token_version: int | None) -> User:
    """账号被停用或令牌版本过期时立即失效（无需等令牌过期）。"""
    if user is None:
        raise ApiError(401, "user_not_found", "账号不存在，请重新登录。")
    if user.status != "active":
        raise ApiError(
            401, "account_disabled", STATUS_MESSAGES.get(user.status, "账号不可用。")
        )
    if token_version != user.token_version:
        raise ApiError(401, "token_revoked", "登录状态已失效，请重新登录。")
    return user


def auth_required(*roles: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = check_user_usable(current_user, get_jwt().get("ver"))
            if roles and user.role not in roles:
                raise forbidden()
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def me() -> User:
    """在 @auth_required 保护的视图中获取当前用户。"""
    return current_user
