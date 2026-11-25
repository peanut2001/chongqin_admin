"""用户管理（仅管理员）。列表接口与前端表格的 URL 参数一致：
GET /users?page=1&pageSize=10&status=active&status=invited&role=student&username=li&sort=createdAt.desc
"""

import re
from typing import Literal

from flask import Blueprint, request
from pydantic import Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.auth.decorators import auth_required, me
from app.errors import not_found
from app.extensions import db
from app.models import User
from app.models.identity import ROLES, STATUSES
from app.schemas import CamelModel, parse_body
from app.serializers import user_full
from app.services import users as svc

bp = Blueprint("users", __name__)

Role = Literal["admin", "teacher", "student"]
# 简单的邮箱格式校验（无需额外依赖）
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
Status = Literal["active", "inactive", "invited", "suspended"]

SORTABLE = {
    "createdAt": User.created_at,
    "username": User.username,
    "email": User.email,
    "role": User.role,
    "status": User.status,
}


def _password_rule(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if len(value) < 8:
        raise ValueError("密码长度至少为 8 个字符。")
    if not re.search(r"[a-z]", value):
        raise ValueError("密码必须包含至少一个小写字母。")
    if not re.search(r"\d", value):
        raise ValueError("密码必须包含至少一个数字。")
    return value


class UserCreate(CamelModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(default="", max_length=50)
    username: str = Field(min_length=1, max_length=50)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    phone_number: str = Field(default="", max_length=30)
    role: Role
    password: str
    status: Status = "active"
    student_no: str | None = Field(default=None, max_length=20)
    class_id: int | None = None

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        if not _password_rule(value):
            raise ValueError("密码为必填项。")
        return value


class UserUpdate(CamelModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    username: str | None = Field(default=None, min_length=1, max_length=50)
    email: str | None = Field(default=None, pattern=EMAIL_PATTERN, max_length=254)
    phone_number: str | None = Field(default=None, max_length=30)
    role: Role | None = None
    status: Status | None = None
    # 留空表示不修改密码
    password: str | None = None
    student_no: str | None = Field(default=None, max_length=20)
    class_id: int | None = None

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str | None) -> str | None:
        return _password_rule(value)


class UserInvite(CamelModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    role: Role


class BulkAction(CamelModel):
    action: Literal["delete", "activate", "deactivate", "suspend"]
    ids: list[str] = Field(min_length=1, max_length=500)


def _get_user(user_id: str) -> User:
    uid = svc.parse_uuid(user_id)
    user = db.session.get(User, uid) if uid else None
    if user is None:
        raise not_found("用户")
    return user


def _filters(statuses, roles, keyword):
    conds = []
    if statuses:
        conds.append(User.status.in_(statuses))
    if roles:
        conds.append(User.role.in_(roles))
    if keyword:
        like = f"%{keyword.lower()}%"
        conds.append(
            or_(
                func.lower(User.username).like(like),
                func.lower(User.email).like(like),
                func.lower(User.first_name + User.last_name).like(like),
                func.lower(User.last_name + User.first_name).like(like),
            )
        )
    return conds


def _facet(column, conds) -> dict[str, int]:
    rows = db.session.execute(select(column, func.count()).where(*conds).group_by(column))
    return {k: v for k, v in rows}


@bp.get("/users")
@auth_required("admin")
def list_users():
    page = max(request.args.get("page", 1, type=int), 1)
    page_size = min(max(request.args.get("pageSize", 10, type=int), 1), 100)
    statuses = [s for s in request.args.getlist("status") if s in STATUSES]
    roles = [r for r in request.args.getlist("role") if r in ROLES]
    keyword = (request.args.get("username") or "").strip()

    sort_field, _, direction = (request.args.get("sort") or "createdAt.desc").partition(".")
    column = SORTABLE.get(sort_field, User.created_at)
    order = column.asc() if direction == "asc" else column.desc()

    conds = _filters(statuses, roles, keyword)
    total = db.session.scalar(select(func.count()).select_from(User).where(*conds)) or 0
    items = db.session.scalars(
        select(User)
        .options(selectinload(User.school_class))
        .where(*conds)
        .order_by(order, User.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [user_full(u) for u in items],
        "total": total,
        "page": page,
        "pageSize": page_size,
        # 分面计数：应用除自身以外的其他筛选条件
        "facets": {
            "status": _facet(User.status, _filters([], roles, keyword)),
            "role": _facet(User.role, _filters(statuses, [], keyword)),
        },
    }


@bp.post("/users")
@auth_required("admin")
def create_user():
    body = parse_body(UserCreate)
    user = svc.create_user(me(), body.model_dump())
    db.session.commit()
    return user_full(user), 201


@bp.post("/users/invite")
@auth_required("admin")
def invite_user():
    body = parse_body(UserInvite)
    base = re.sub(r"[^a-zA-Z0-9_.-]", "", body.email.split("@")[0]) or "user"
    username, n = base, 1
    while db.session.scalar(select(User.id).where(func.lower(User.username) == username.lower())):
        n += 1
        username = f"{base}{n}"
    # 受邀用户没有密码，暂无邮件服务：需管理员在编辑中设置密码后才能登录
    user = svc.create_user(
        me(),
        {"email": body.email, "username": username, "first_name": base, "role": body.role, "status": "invited"},
    )
    db.session.commit()
    return user_full(user), 201


@bp.patch("/users/<user_id>")
@auth_required("admin")
def update_user(user_id: str):
    user = _get_user(user_id)
    body = parse_body(UserUpdate)
    data = body.model_dump(exclude_unset=True)
    if not data.get("password"):
        data.pop("password", None)
    svc.update_user(me(), user, data)
    db.session.commit()
    return user_full(user)


@bp.delete("/users/<user_id>")
@auth_required("admin")
def delete_user(user_id: str):
    user = _get_user(user_id)
    svc.delete_user(me(), user)
    db.session.commit()
    return "", 204


@bp.post("/users/bulk")
@auth_required("admin")
def bulk():
    body = parse_body(BulkAction)
    actor = me()
    affected, skipped = 0, []
    status_for = {"activate": "active", "deactivate": "inactive", "suspend": "suspended"}
    for raw_id in body.ids:
        uid = svc.parse_uuid(raw_id)
        user = db.session.get(User, uid) if uid else None
        if user is None:
            skipped.append({"id": raw_id, "reason": "not_found"})
            continue
        reason = svc.bulk_check(actor, user, body.action)
        if reason:
            skipped.append({"id": raw_id, "reason": reason})
            continue
        if body.action == "delete":
            svc.delete_user(actor, user)
        else:
            svc.set_status(actor, user, status_for[body.action])
        # 逐个 flush，后续的「最后一个管理员」判断才能看到前面的变更
        db.session.flush()
        affected += 1
    db.session.commit()
    return {"affected": affected, "skipped": skipped}
