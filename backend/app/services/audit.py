"""审计日志：记录登录与用户管理等敏感操作，也用于登录失败限流计数。"""

import uuid
from datetime import timedelta

from flask import current_app, has_request_context, request
from sqlalchemy import func, or_, select

from app.extensions import db
from app.models import AuditLog
from app.services.timeutil import now_utc


def client_ip() -> str | None:
    if not has_request_context():
        return None
    # 不直接读 X-Forwarded-For（客户端可伪造）：配置了可信反向代理（TRUSTED_PROXIES）时，
    # ProxyFix 已按代理层数把真实客户端 IP 写进 remote_addr
    return request.remote_addr or None


def log(
    action: str,
    actor_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    detail: dict | None = None,
) -> None:
    db.session.add(
        AuditLog(
            action=action,
            actor_id=actor_id,
            target_type=target_type,
            target_id=target_id,
            detail=detail,
            ip=client_ip(),
        )
    )


def recent_login_failures(email: str) -> int:
    window = now_utc() - timedelta(minutes=current_app.config["LOGIN_FAIL_WINDOW_MINUTES"])
    ip = client_ip()
    conditions = [AuditLog.detail["email"].astext == email.lower()]
    if ip:
        conditions.append(AuditLog.ip == ip)
    stmt = select(func.count()).where(
        AuditLog.action == "auth.login_failed",
        AuditLog.created_at >= window,
        or_(*conditions),
    )
    return db.session.scalar(stmt) or 0
