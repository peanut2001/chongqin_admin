"""登录 / 刷新 / 退出。

- access token：15 分钟，前端只存内存，放在 Authorization 头里。
- refresh token：7 天，httpOnly cookie（Path=/api/auth，SameSite=Strict），JS 读不到。
"""

from datetime import UTC, datetime

from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    current_user,
    get_jwt,
    set_refresh_cookies,
    unset_refresh_cookies,
    verify_jwt_in_request,
)
from pydantic import Field
from sqlalchemy import delete, func, select

from app.auth.decorators import DEMO_DISABLED_MESSAGE, STATUS_MESSAGES, check_user_usable, demo_login_blocked
from app.errors import ApiError
from app.extensions import db
from app.models import RevokedToken, User
from app.schemas import CamelModel, parse_body
from app.serializers import auth_user
from app.services import audit
from app.services.passwords import verify_password
from app.services.timeutil import iso, now_utc

bp = Blueprint("auth", __name__)


class LoginBody(CamelModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


def _session_response(user: User, status: int = 200, with_refresh: bool = True):
    claims = {"ver": user.token_version}
    access = create_access_token(identity=str(user.id), additional_claims=claims)
    expires = now_utc() + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    resp = jsonify(
        {"accessToken": access, "accessTokenExpiresAt": iso(expires), "user": auth_user(user)}
    )
    if with_refresh:
        refresh = create_refresh_token(identity=str(user.id), additional_claims=claims)
        set_refresh_cookies(resp, refresh)
    return resp, status


@bp.post("/auth/login")
def login():
    body = parse_body(LoginBody)
    email = body.email.lower()

    if audit.recent_login_failures(email) >= current_app.config["LOGIN_FAIL_LIMIT"]:
        raise ApiError(429, "too_many_attempts", "尝试次数过多，请稍后再试。")

    user = db.session.scalar(select(User).where(func.lower(User.email) == email))
    # 先校验密码，再看账号状态：避免未登录的人探测账号是否被停用
    if user is None or not verify_password(user.password_hash, body.password):
        audit.log("auth.login_failed", detail={"email": email})
        db.session.commit()
        raise ApiError(401, "invalid_credentials", "邮箱或密码错误。")

    if user.status != "active":
        raise ApiError(403, f"account_{user.status}", STATUS_MESSAGES[user.status])
    if demo_login_blocked(user):
        raise ApiError(403, "demo_disabled", DEMO_DISABLED_MESSAGE)

    user.last_login_at = now_utc()
    audit.log("auth.login", actor_id=user.id, target_type="user", target_id=str(user.id))
    # 顺手清理已过期的吊销记录
    db.session.execute(delete(RevokedToken).where(RevokedToken.expires_at < now_utc()))
    db.session.commit()
    return _session_response(user)


@bp.post("/auth/refresh")
def refresh():
    verify_jwt_in_request(refresh=True, locations=["cookies"])
    user = check_user_usable(current_user, get_jwt().get("ver"))
    # 只换发 access token，refresh cookie 保持到期
    return _session_response(user, with_refresh=False)


@bp.post("/auth/logout")
def logout():
    # 未登录也允许调用：总能清掉 cookie
    verify_jwt_in_request(refresh=True, locations=["cookies"], optional=True)
    payload = get_jwt()
    if payload.get("jti"):
        db.session.merge(
            RevokedToken(
                jti=payload["jti"], expires_at=datetime.fromtimestamp(payload["exp"], UTC)
            )
        )
        db.session.commit()
    resp = jsonify({})
    unset_refresh_cookies(resp)
    return resp, 200
