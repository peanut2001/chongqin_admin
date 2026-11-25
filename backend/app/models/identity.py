"""用户、班级、学期、令牌吊销、审计日志、上传文件。"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

ROLES = ("admin", "teacher", "student")
STATUSES = ("active", "inactive", "invited", "suspended")


def _in(col: str, values: tuple[str, ...]) -> str:
    return f"{col} IN ({', '.join(repr(v) for v in values)})"


class SchoolClass(db.Model):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    cohort_year: Mapped[int | None] = mapped_column(SmallInteger)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    students: Mapped[list["User"]] = relationship(back_populates="school_class")


class Semester(db.Model):
    __tablename__ = "semesters"
    __table_args__ = (
        # 同一时间只能有一个当前学期
        Index("uq_semesters_current", "is_current", unique=True, postgresql_where=text("is_current")),
        CheckConstraint("end_date > start_date", name="date_range"),
        CheckConstraint("total_weeks BETWEEN 1 AND 30", name="total_weeks"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    course: Mapped[str] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    total_weeks: Mapped[int] = mapped_column(SmallInteger)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(_in("role", ROLES), name="role"),
        CheckConstraint(_in("status", STATUSES), name="status"),
        CheckConstraint(
            "role = 'student' OR (student_no IS NULL AND class_id IS NULL)",
            name="student_fields",
        ),
        Index("uq_users_email_lower", func.lower(text("email")), unique=True),
        Index("uq_users_username_lower", func.lower(text("username")), unique=True),
        Index("ix_users_created_at", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text)
    username: Mapped[str] = mapped_column(Text)
    first_name: Mapped[str] = mapped_column(Text, default="")
    last_name: Mapped[str] = mapped_column(Text, default="", server_default="")
    phone_number: Mapped[str] = mapped_column(Text, default="", server_default="")
    role: Mapped[str] = mapped_column(String(16), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True, default="active")
    # invited 用户尚未设置密码
    password_hash: Mapped[str | None] = mapped_column(Text)
    # 递增即作废该用户已签发的全部令牌（改密、停用、改角色时）
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    student_no: Mapped[str | None] = mapped_column(Text, unique=True)
    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id", ondelete="SET NULL"), index=True
    )
    avatar_upload_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("uploads.id", ondelete="SET NULL", use_alter=True)
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    school_class: Mapped[SchoolClass | None] = relationship(back_populates="students")
    avatar: Mapped["Upload | None"] = relationship(foreign_keys=[avatar_upload_id])

    @property
    def display_name(self) -> str:
        # 中文姓名按「姓名」顺序且不加空格（李明），西文按「名 姓」（Alex Smith）
        if any("一" <= ch <= "鿿" for ch in self.first_name + self.last_name):
            return f"{self.last_name}{self.first_name}" or self.username
        return f"{self.first_name} {self.last_name}".strip() or self.username


class RevokedToken(db.Model):
    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(Text, primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created_at", text("created_at DESC")),
        Index("ix_audit_logs_action_created", "action", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(Text)
    target_type: Mapped[str | None] = mapped_column(Text)
    target_id: Mapped[str | None] = mapped_column(Text)
    detail: Mapped[dict | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


UPLOAD_KINDS = ("avatar", "ai_image")


class Upload(db.Model):
    __tablename__ = "uploads"
    __table_args__ = (CheckConstraint(_in("kind", UPLOAD_KINDS), name="kind"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16))
    # 存储路径由服务端生成（kind/uuid），不使用用户提供的文件名
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    # 由文件内容嗅探得出，不信任浏览器提供的类型
    content_type: Mapped[str] = mapped_column(Text)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    original_name: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
