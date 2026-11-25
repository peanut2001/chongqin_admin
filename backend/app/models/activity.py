"""学习行为记录：一切学情统计的数据来源。每行都有 is_demo，便于一键清除演示数据。"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.identity import _in

SESSION_STATUSES = ("in_progress", "finished", "abandoned")
AGREEMENTS = ("一致", "部分一致", "不一致")


class PracticeSession(db.Model):
    __tablename__ = "practice_sessions"
    __table_args__ = (
        CheckConstraint(_in("status", SESSION_STATUSES), name="status"),
        Index("ix_practice_sessions_user_started", "user_id", text("started_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    set_id: Mapped[str] = mapped_column(ForeignKey("question_sets.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")
    question_count: Mapped[int] = mapped_column(SmallInteger)
    correct_count: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    attempts: Mapped[list["PracticeAttempt"]] = relationship(
        order_by="PracticeAttempt.position", cascade="all, delete-orphan"
    )


class PracticeAttempt(db.Model):
    """开始练习时即为每道题建一行，服务端固定抽到的题目与顺序。"""

    __tablename__ = "practice_attempts"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_practice_attempts_session_question"),
        Index("ix_practice_attempts_user_answered", "user_id", "answered_at"),
        Index(
            "ix_practice_attempts_answered",
            "answered_at",
            postgresql_where=text("answered_at IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_sessions.id", ondelete="CASCADE")
    )
    # 冗余 user_id，统计时免 join
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    selected: Mapped[list[str] | None] = mapped_column(JSONB)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    time_spent_ms: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    question = relationship("Question")


class CaseView(db.Model):
    __tablename__ = "case_views"
    __table_args__ = (Index("ix_case_views_user_viewed", "user_id", "viewed_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))


class AiReading(db.Model):
    __tablename__ = "ai_readings"
    __table_args__ = (
        CheckConstraint(
            "sample_id IS NOT NULL OR upload_id IS NOT NULL", name="has_image"
        ),
        CheckConstraint(f"agreement IS NULL OR {_in('agreement', AGREEMENTS)}", name="agreement"),
        Index("ix_ai_readings_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    sample_id: Mapped[str | None] = mapped_column(ForeignKey("ai_samples.id", ondelete="SET NULL"))
    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("uploads.id", ondelete="SET NULL")
    )
    modality: Mapped[str] = mapped_column(Text)
    student_opinion: Mapped[str] = mapped_column(Text)
    # 真实模型的输出结构可能变化，用 jsonb 原样保存
    result: Mapped[dict] = mapped_column(JSONB)
    # 'demo' 表示演示结果；接入真实模型后为 'model:<name>'
    result_source: Mapped[str] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(Text)
    agreement: Mapped[str | None] = mapped_column(Text)
    agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

    sample = relationship("AiSample")
    upload = relationship("Upload")
    user = relationship("User")
