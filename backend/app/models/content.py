"""教学内容（由 flask content import 导入，读多写少）：病种、病例、病例图片、题库、AI 示例。"""

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.extensions import db
from app.models.identity import _in

DIFFICULTIES = ("基础", "进阶", "疑难")
GENDERS = ("Male", "Female", "Transgender", "Unknown")
QUESTION_TYPES = ("single", "multiple", "judge")
SET_KINDS = ("chapter", "case_diagnosis")


class DiseaseTopic(db.Model):
    __tablename__ = "disease_topics"
    __table_args__ = (CheckConstraint(_in("difficulty", DIFFICULTIES), name="difficulty"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # CASE-0001
    title: Mapped[str] = mapped_column(Text)
    system: Mapped[str] = mapped_column(Text)
    modality: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    # 只随病种整体读取、从不单独查询，用 jsonb 即可
    key_points: Mapped[list[str]] = mapped_column(JSONB)
    tags: Mapped[list[str]] = mapped_column(JSONB)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Case(db.Model):
    __tablename__ = "cases"
    __table_args__ = (CheckConstraint(_in("gender", GENDERS), name="gender"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # BL-0101
    topic_id: Mapped[str] = mapped_column(
        ForeignKey("disease_topics.id", ondelete="RESTRICT"), index=True
    )
    patient_id: Mapped[str] = mapped_column(Text)
    age: Mapped[int | None] = mapped_column(SmallInteger)
    gender: Mapped[str] = mapped_column(Text)
    excerpt: Mapped[str] = mapped_column(Text)
    # 全文只在详情接口返回
    full_text: Mapped[str] = deferred(mapped_column(Text))
    cover_index: Mapped[int] = mapped_column(SmallInteger, default=0)
    # 出处与许可：单独成列，许可是会被查询的属性（如列出 NC 许可病例），不允许为空
    source_pmcid: Mapped[str] = mapped_column(Text)
    source_title: Mapped[str] = mapped_column(Text)
    source_authors: Mapped[list[str]] = mapped_column(JSONB)
    source_journal: Mapped[str] = mapped_column(Text)
    source_year: Mapped[str] = mapped_column(Text)
    source_doi: Mapped[str] = mapped_column(Text, default="")
    license: Mapped[str] = mapped_column(Text, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))

    topic: Mapped[DiseaseTopic] = relationship()
    images: Mapped[list["CaseImage"]] = relationship(
        order_by="CaseImage.position", cascade="all, delete-orphan"
    )


class CaseImage(db.Model):
    __tablename__ = "case_images"
    __table_args__ = (UniqueConstraint("case_id", "position", name="uq_case_images_case_position"),)

    # 对外公开的不透明 id（uuid5(case_id/position)，重复导入保持不变），URL 中不含病例编号
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(SmallInteger)  # 从 1 开始
    storage_key: Mapped[str] = mapped_column(Text)  # 相对 CONTENT_DIR/case-images
    caption: Mapped[str] = mapped_column(Text, default="")
    image_type: Mapped[str] = mapped_column(Text)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    original_file: Mapped[str | None] = mapped_column(Text)


class QuestionSet(db.Model):
    __tablename__ = "question_sets"
    __table_args__ = (CheckConstraint(_in("kind", SET_KINDS), name="kind"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # chest / case-diagnosis
    name: Mapped[str] = mapped_column(Text)
    short_name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(32))
    # 每次练习随机抽取的题数；为空则按顺序练习全部题目
    session_size: Mapped[int | None] = mapped_column(SmallInteger)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class Question(db.Model):
    __tablename__ = "questions"
    __table_args__ = (CheckConstraint(_in("type", QUESTION_TYPES), name="type"),)

    # 不透明 id（uuid5(code)）；code 仅用于导入对齐，绝不返回给前端
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    set_id: Mapped[str] = mapped_column(ForeignKey("question_sets.id"), index=True)
    type: Mapped[str] = mapped_column(String(16))
    stem: Mapped[str] = mapped_column(Text)
    # 选项与答案总随题目一起读取，且导入时已校验，用 jsonb
    options: Mapped[list[dict]] = mapped_column(JSONB)
    answer: Mapped[list[str]] = mapped_column(JSONB)
    explanation: Mapped[str] = mapped_column(Text)
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("disease_topics.id"))
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id"))
    presentation: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))

    images: Mapped[list["QuestionImage"]] = relationship(
        order_by="QuestionImage.position", cascade="all, delete-orphan"
    )


class QuestionImage(db.Model):
    __tablename__ = "question_images"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    case_image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("case_images.id", ondelete="CASCADE")
    )

    case_image: Mapped[CaseImage] = relationship()


class AiSample(db.Model):
    __tablename__ = "ai_samples"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # S-01
    name: Mapped[str] = mapped_column(Text)
    modality: Mapped[str] = mapped_column(Text)
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("disease_topics.id"))
    case_image_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("case_images.id", ondelete="SET NULL")
    )
    demo_result: Mapped[dict] = mapped_column(JSONB)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    case_image: Mapped[CaseImage | None] = relationship()


class AppSetting(db.Model):
    """少量全局配置（如 AI 判读可选的检查类型列表）。"""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[dict | list] = mapped_column(JSONB)
