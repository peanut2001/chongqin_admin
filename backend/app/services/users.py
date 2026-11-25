"""用户管理业务规则（服务端强制执行，不依赖前端界面）：
- 管理员不能删除 / 停用自己，也不能修改自己的角色；
- 系统中最后一个启用的管理员不能被降级、停用或删除；
- 修改密码 / 状态 / 角色会递增 token_version，使该用户已有登录立即失效。
"""

import uuid

from sqlalchemy import func, select

from app.errors import ApiError
from app.extensions import db
from app.models import SchoolClass, User
from app.services import audit
from app.services.passwords import hash_password


def active_admin_count(exclude: uuid.UUID | None = None) -> int:
    stmt = select(func.count()).where(User.role == "admin", User.status == "active")
    if exclude:
        stmt = stmt.where(User.id != exclude)
    return db.session.scalar(stmt) or 0


def check_conflicts(email: str | None, username: str | None, student_no: str | None, exclude: uuid.UUID | None = None):
    fields: dict[str, str] = {}

    def taken(column, value) -> bool:
        stmt = select(User.id).where(func.lower(column) == value.lower())
        if exclude:
            stmt = stmt.where(User.id != exclude)
        return db.session.scalar(stmt) is not None

    if email and taken(User.email, email):
        fields["email"] = "该邮箱已被其他用户使用。"
    if username and taken(User.username, username):
        fields["username"] = "该用户名已被使用。"
    if student_no and taken(User.student_no, student_no):
        fields["studentNo"] = "该学号已被使用。"
    if fields:
        raise ApiError(409, "conflict", "提交的信息与已有用户冲突。", fields)


def _check_class(class_id: int | None) -> None:
    if class_id is not None and db.session.get(SchoolClass, class_id) is None:
        raise ApiError(422, "validation_error", "提交的数据有误。", {"classId": "班级不存在。"})


def _normalize_student_fields(user: User) -> None:
    # 非学生不保留学号与班级（数据库也有约束）
    if user.role != "student":
        user.student_no = None
        user.class_id = None


def create_user(actor: User, data: dict) -> User:
    check_conflicts(data["email"], data["username"], data.get("student_no"))
    _check_class(data.get("class_id"))
    password = data.pop("password", None)
    user = User(**data)
    if password:
        user.password_hash = hash_password(password)
    _normalize_student_fields(user)
    db.session.add(user)
    db.session.flush()
    audit.log("user.create", actor.id, "user", str(user.id), {"email": user.email, "role": user.role})
    return user


def update_user(actor: User, user: User, data: dict) -> User:
    is_self = actor.id == user.id
    if is_self:
        if "role" in data and data["role"] != user.role:
            raise ApiError(409, "self_protection", "不能修改自己的角色。")
        if "status" in data and data["status"] != "active":
            raise ApiError(409, "self_protection", "不能停用自己。")

    demoting = user.role == "admin" and (
        data.get("role", "admin") != "admin" or data.get("status", "active") != "active"
    )
    if demoting and user.status == "active" and active_admin_count(exclude=user.id) == 0:
        raise ApiError(409, "last_admin", "这是最后一个启用的管理员，不能降级或停用。")

    check_conflicts(data.get("email"), data.get("username"), data.get("student_no"), exclude=user.id)
    if "class_id" in data:
        _check_class(data["class_id"])

    revoke = False
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
        revoke = True
        # 管理员设置了密码的受邀用户可以直接登录
        if user.status == "invited" and "status" not in data:
            data["status"] = "active"
    for key in ("role", "status"):
        if key in data and data[key] != getattr(user, key):
            revoke = True
    for key, value in data.items():
        setattr(user, key, value)
    _normalize_student_fields(user)
    if revoke:
        user.token_version += 1

    detail = {k: v for k, v in data.items() if k in ("role", "status", "email")}
    if password:
        detail["passwordReset"] = True
    audit.log("user.update", actor.id, "user", str(user.id), detail or None)
    return user


def bulk_check(actor: User, user: User, action: str) -> str | None:
    """返回跳过原因；None 表示可以执行。"""
    if action in ("delete", "deactivate", "suspend") and user.id == actor.id:
        return "self"
    if (
        action in ("delete", "deactivate", "suspend")
        and user.role == "admin"
        and user.status == "active"
        and active_admin_count(exclude=user.id) == 0
    ):
        return "last_admin"
    return None


def delete_user(actor: User, user: User) -> None:
    reason = bulk_check(actor, user, "delete")
    if reason == "self":
        raise ApiError(409, "self_protection", "不能删除自己。")
    if reason == "last_admin":
        raise ApiError(409, "last_admin", "这是最后一个启用的管理员，不能删除。")
    audit.log("user.delete", actor.id, "user", str(user.id), {"email": user.email})
    db.session.delete(user)


def set_status(actor: User, user: User, status: str) -> None:
    if user.status != status:
        user.status = status
        user.token_version += 1
        audit.log("user.status", actor.id, "user", str(user.id), {"status": status})


def parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None
