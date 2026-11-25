"""教学内容导入：flask content import [--prune]

读取 CONTENT_DIR 下的 JSON（由 scripts/export-content.mjs 导出），先用 pydantic 全量校验，
任何错误（如缺少许可、图片文件不存在）都会在写库前中止。导入是幂等的：
病例图片与题目的 id 由 uuid5 生成，重复导入保持不变（URL、练习记录都不受影响）。
"""

import json
import uuid
from pathlib import Path
from typing import Literal

import click
from flask import current_app
from flask.cli import AppGroup
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.extensions import db
from app.models import (
    AiSample,
    AppSetting,
    Case,
    CaseImage,
    DiseaseTopic,
    Question,
    QuestionImage,
    QuestionSet,
)

content_cli = AppGroup("content", help="教学内容导入")

NS = uuid.UUID("5d7c0f2e-9a51-4c38-9f1c-1c2b8d7e6a40")


def case_image_uuid(case_id: str, position: int) -> uuid.UUID:
    return uuid.uuid5(NS, f"case-image:{case_id}/{position}")


def question_uuid(code: str) -> uuid.UUID:
    return uuid.uuid5(NS, f"question:{code}")


class _M(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class TopicIn(_M):
    id: str
    title: str
    system: str
    modality: str
    difficulty: Literal["基础", "进阶", "疑难"]
    summary: str
    key_points: list[str]
    tags: list[str]
    sort_order: int = 0


class SourceIn(_M):
    pmcid: str = Field(min_length=3)
    title: str
    authors: list[str]
    journal: str
    year: str
    doi: str = ""
    license: str = Field(min_length=2)


class CaseImageIn(_M):
    src: str
    caption: str = ""
    type: str
    width: int
    height: int
    file: str | None = None


class CaseIn(_M):
    id: str
    topic_id: str
    patient_id: str
    age: int | None
    gender: Literal["Male", "Female", "Transgender", "Unknown"]
    excerpt: str
    cover_index: int
    source: SourceIn
    images: list[CaseImageIn] = Field(min_length=1)


class ImageRef(_M):
    case_id: str
    position: int


class Option(_M):
    key: str
    text: str


class QuestionIn(_M):
    code: str
    type: Literal["single", "multiple", "judge"]
    stem: str
    options: list[Option] = Field(min_length=2)
    answer: list[str] = Field(min_length=1)
    explanation: str
    topic_id: str | None = None
    case_id: str | None = None
    presentation: str | None = None
    images: list[ImageRef] = []
    sort_order: int = 0

    @model_validator(mode="after")
    def _check_answer(self):
        keys = {o.key for o in self.options}
        if not set(self.answer) <= keys:
            raise ValueError(f"{self.code}: 答案不在选项中")
        if self.type in ("single", "judge") and len(self.answer) != 1:
            raise ValueError(f"{self.code}: 单选/判断题必须只有一个答案")
        return self


class SetIn(_M):
    id: str
    name: str
    short_name: str
    description: str
    kind: Literal["chapter", "case_diagnosis"]
    session_size: int | None = None
    sort_order: int = 0
    questions: list[QuestionIn]


class AiSampleIn(_M):
    id: str
    name: str
    modality: str
    topic_id: str | None = None
    image: ImageRef | None = None
    demo_result: dict
    sort_order: int = 0


class AiFileIn(_M):
    modalities: list[str]
    samples: list[AiSampleIn]


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_content(content_dir: Path) -> dict:
    """读取并校验全部内容文件；任何问题都抛出 click.ClickException。"""
    try:
        topics = [TopicIn.model_validate(t) for t in _load(content_dir / "disease_topics.json")]
        cases = [CaseIn.model_validate(c) for c in _load(content_dir / "case_library.json")]
        texts: dict[str, str] = _load(content_dir / "case_texts.json")
        sets = [SetIn.model_validate(s) for s in _load(content_dir / "question_sets.json")]
        ai = AiFileIn.model_validate(_load(content_dir / "ai_samples.json"))
    except (OSError, ValueError, ValidationError) as exc:
        raise click.ClickException(f"内容文件校验失败：{exc}") from exc

    topic_ids = {t.id for t in topics}
    image_root = content_dir / "case-images"
    errors = []
    positions: dict[str, int] = {}
    for c in cases:
        if c.topic_id not in topic_ids:
            errors.append(f"{c.id}: 未知病种 {c.topic_id}")
        if c.id not in texts:
            errors.append(f"{c.id}: 缺少病例原文")
        positions[c.id] = len(c.images)
        for img in c.images:
            key = img.src.removeprefix("/cases/")
            if not (image_root / key).is_file():
                errors.append(f"{c.id}: 图片文件不存在 {key}")
    for s in sets:
        for q in s.questions:
            for ref in q.images:
                if positions.get(ref.case_id, 0) < ref.position:
                    errors.append(f"{q.code}: 引用了不存在的图片 {ref.case_id}/{ref.position}")
            if q.case_id and q.case_id not in positions:
                errors.append(f"{q.code}: 引用了不存在的病例 {q.case_id}")
    if errors:
        raise click.ClickException("内容校验失败：\n" + "\n".join(errors[:20]))
    return {"topics": topics, "cases": cases, "texts": texts, "sets": sets, "ai": ai}


def _upsert(model, rows: list[dict], key: str = "id") -> None:
    if not rows:
        return
    stmt = insert(model).values(rows)
    cols = {c: stmt.excluded[c] for c in rows[0] if c != key}
    db.session.execute(stmt.on_conflict_do_update(index_elements=[key], set_=cols))


def import_content(content_dir: Path, prune: bool = False) -> dict[str, int]:
    data = load_content(content_dir)

    _upsert(DiseaseTopic, [t.model_dump() for t in data["topics"]])

    _upsert(
        Case,
        [
            {
                "id": c.id,
                "topic_id": c.topic_id,
                "patient_id": c.patient_id,
                "age": c.age,
                "gender": c.gender,
                "excerpt": c.excerpt,
                "full_text": data["texts"][c.id],
                "cover_index": c.cover_index,
                "source_pmcid": c.source.pmcid,
                "source_title": c.source.title,
                "source_authors": c.source.authors,
                "source_journal": c.source.journal,
                "source_year": c.source.year,
                "source_doi": c.source.doi,
                "license": c.source.license,
                "sort_order": i,
                "is_published": True,
            }
            for i, c in enumerate(data["cases"])
        ],
    )
    _upsert(
        CaseImage,
        [
            {
                "id": case_image_uuid(c.id, pos),
                "case_id": c.id,
                "position": pos,
                "storage_key": img.src.removeprefix("/cases/"),
                "caption": img.caption,
                "image_type": img.type,
                "width": img.width,
                "height": img.height,
                "original_file": img.file,
            }
            for c in data["cases"]
            for pos, img in enumerate(c.images, start=1)
        ],
    )

    _upsert(
        QuestionSet,
        [
            {**s.model_dump(exclude={"questions"}), "is_published": True}
            for s in data["sets"]
        ],
    )
    q_rows, qi_rows = [], []
    for s in data["sets"]:
        for q in s.questions:
            qid = question_uuid(q.code)
            q_rows.append(
                {
                    "id": qid,
                    "code": q.code,
                    "set_id": s.id,
                    "type": q.type,
                    "stem": q.stem,
                    "options": [o.model_dump() for o in q.options],
                    "answer": q.answer,
                    "explanation": q.explanation,
                    "topic_id": q.topic_id,
                    "case_id": q.case_id,
                    "presentation": q.presentation,
                    "sort_order": q.sort_order,
                    "is_active": True,
                }
            )
            qi_rows += [
                {"question_id": qid, "position": i, "case_image_id": case_image_uuid(r.case_id, r.position)}
                for i, r in enumerate(q.images, start=1)
            ]
    _upsert(Question, q_rows)
    # 题目配图整体替换
    db.session.execute(delete(QuestionImage).where(QuestionImage.question_id.in_([r["id"] for r in q_rows])))
    if qi_rows:
        db.session.execute(insert(QuestionImage).values(qi_rows))

    _upsert(
        AiSample,
        [
            {
                "id": s.id,
                "name": s.name,
                "modality": s.modality,
                "topic_id": s.topic_id,
                "case_image_id": case_image_uuid(s.image.case_id, s.image.position) if s.image else None,
                "demo_result": s.demo_result,
                "sort_order": s.sort_order,
            }
            for s in data["ai"].samples
        ],
    )
    _upsert(AppSetting, [{"key": "ai_modalities", "value": data["ai"].modalities}], key="key")

    if prune:
        # 内容文件中已不存在的条目只下架、不删除（练习记录仍引用它们）
        case_ids = [c.id for c in data["cases"]]
        db.session.execute(update(Case).where(Case.id.not_in(case_ids)).values(is_published=False))
        db.session.execute(
            update(Question).where(Question.code.not_in([r["code"] for r in q_rows])).values(is_active=False)
        )
    db.session.commit()

    def count(model):
        return db.session.scalar(select(func.count()).select_from(model))

    return {
        "topics": count(DiseaseTopic),
        "cases": count(Case),
        "case_images": count(CaseImage),
        "question_sets": count(QuestionSet),
        "questions": count(Question),
        "question_images": count(QuestionImage),
        "ai_samples": count(AiSample),
    }


@content_cli.command("import")
@click.option("--prune", is_flag=True, help="下架内容文件中已不存在的病例与题目")
def import_cmd(prune: bool):
    """导入病种、病例、病例图片、题库与 AI 判读示例。"""
    counts = import_content(Path(current_app.config["CONTENT_DIR"]), prune=prune)
    click.echo("imported: " + ", ".join(f"{k}={v}" for k, v in counts.items()))


@content_cli.command("licenses")
def licenses_cmd():
    """按许可统计已发布病例（NC 许可仅限非商业教学使用）。"""
    rows = db.session.execute(
        select(Case.license, func.count()).where(Case.is_published.is_(True)).group_by(Case.license)
    )
    for license_, n in rows:
        note = "（仅限非商业用途）" if "NC" in license_ else ""
        click.echo(f"{license_}: {n}{note}")
