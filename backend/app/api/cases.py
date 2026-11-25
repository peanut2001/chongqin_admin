"""病例库：病种、病例列表 / 详情、浏览记录（学情统计的数据来源之一）。"""

from datetime import timedelta

from flask import Blueprint
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload, undefer

from app.auth.decorators import auth_required, me
from app.errors import not_found
from app.extensions import db
from app.models import Case, CaseView, DiseaseTopic
from app.schemas import CamelModel, parse_body
from app.services.timeutil import now_utc

bp = Blueprint("cases", __name__)

VIEW_DEDUPE = timedelta(minutes=30)
MAX_VIEW_SECONDS = 30 * 60


def case_image_url(image_id) -> str:
    return f"/api/media/case-images/{image_id}"


def topic_dict(t: DiseaseTopic) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "system": t.system,
        "modality": t.modality,
        "difficulty": t.difficulty,
        "summary": t.summary,
        "keyPoints": t.key_points,
        "tags": t.tags,
    }


def case_dict(c: Case, full_text: bool = False) -> dict:
    body = {
        "id": c.id,
        "topicId": c.topic_id,
        "patientId": c.patient_id,
        "age": c.age,
        "gender": c.gender,
        "excerpt": c.excerpt,
        "coverIndex": c.cover_index,
        "source": {
            "pmcid": c.source_pmcid,
            "title": c.source_title,
            "authors": c.source_authors,
            "journal": c.source_journal,
            "year": c.source_year,
            "doi": c.source_doi,
            "license": c.license,
        },
        "images": [
            {
                "id": str(img.id),
                "url": case_image_url(img.id),
                "caption": img.caption,
                "type": img.image_type,
                "width": img.width,
                "height": img.height,
            }
            for img in c.images
        ],
    }
    if full_text:
        body["fullText"] = c.full_text
    return body


@bp.get("/topics")
@auth_required()
def list_topics():
    topics = db.session.scalars(select(DiseaseTopic).order_by(DiseaseTopic.sort_order)).all()
    return [topic_dict(t) for t in topics]


@bp.get("/cases")
@auth_required()
def list_cases():
    # 不含全文（较大），详情接口再返回
    cases = db.session.scalars(
        select(Case)
        .options(selectinload(Case.images))
        .where(Case.is_published.is_(True))
        .order_by(Case.sort_order)
    ).all()
    return [case_dict(c) for c in cases]


@bp.get("/cases/<case_id>")
@auth_required()
def get_case(case_id: str):
    case = db.session.scalar(
        select(Case)
        .options(selectinload(Case.images), undefer(Case.full_text))
        .where(Case.id == case_id, Case.is_published.is_(True))
    )
    if case is None:
        raise not_found("病例")
    return case_dict(case, full_text=True)


@bp.post("/cases/<case_id>/views")
@auth_required()
def record_view(case_id: str):
    """记录一次浏览；同一用户 30 分钟内重复打开同一病例只算一次（也挡住开发模式下的重复请求）。"""
    if db.session.get(Case, case_id) is None:
        raise not_found("病例")
    user = me()
    recent = db.session.scalar(
        select(CaseView)
        .where(
            CaseView.user_id == user.id,
            CaseView.case_id == case_id,
            CaseView.viewed_at >= now_utc() - VIEW_DEDUPE,
        )
        .order_by(CaseView.viewed_at.desc())
        .limit(1)
    )
    if recent is None:
        recent = CaseView(user_id=user.id, case_id=case_id, viewed_at=now_utc())
        db.session.add(recent)
        db.session.commit()
        return {"id": recent.id}, 201
    return {"id": recent.id}, 200


class ViewDuration(CamelModel):
    duration_seconds: int = Field(ge=0, le=24 * 3600)


@bp.patch("/case-views/<int:view_id>")
@auth_required()
def update_view(view_id: int):
    """关闭病例详情时上报停留时长（上限 30 分钟，避免挂机计入学习时长）。"""
    view = db.session.get(CaseView, view_id)
    if view is None or view.user_id != me().id:
        raise not_found("浏览记录")
    body = parse_body(ViewDuration)
    view.duration_seconds = min(
        MAX_VIEW_SECONDS, (view.duration_seconds or 0) + body.duration_seconds
    )
    db.session.commit()
    return {"id": view.id, "durationSeconds": view.duration_seconds}
