"""AI 图像判读：示例图片 / 上传图片 + 学生判读意见 → 演示结果，并保存判读记录。"""

from typing import Literal

from flask import Blueprint, current_app, request
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.cases import case_image_url
from app.auth.decorators import auth_required, me
from app.errors import ApiError, not_found, validation_error_fields
from app.extensions import db
from app.models import AiReading, AiSample, AppSetting
from app.schemas import CamelModel, parse_body
from app.services import ai_demo, media
from app.services.signing import upload_url
from app.services.timeutil import iso, now_utc
from app.services.users import parse_uuid

bp = Blueprint("ai", __name__)


def _modalities() -> list[str]:
    setting = db.session.get(AppSetting, "ai_modalities")
    return list(setting.value) if setting else []


def _image_url(r: AiReading) -> str | None:
    if r.upload_id:
        return upload_url(r.upload_id)
    if r.sample and r.sample.case_image_id:
        return case_image_url(r.sample.case_image_id)
    return None


def reading_dict(r: AiReading) -> dict:
    return {
        "id": str(r.id),
        "student": r.user.display_name if r.user else None,
        "sample": r.sample.name if r.sample else f"上传图像 · {r.modality}",
        "sampleId": r.sample_id,
        "modality": r.modality,
        "opinion": r.student_opinion,
        "result": r.result,
        "resultSource": r.result_source,
        "isDemo": r.result_source == ai_demo.RESULT_SOURCE,
        "disclaimer": ai_demo.DISCLAIMER if r.result_source == ai_demo.RESULT_SOURCE else None,
        "agreement": r.agreement,
        "imageUrl": _image_url(r),
        "createdAt": iso(r.created_at),
    }


@bp.get("/ai/samples")
@auth_required()
def samples():
    rows = db.session.scalars(select(AiSample).order_by(AiSample.sort_order)).all()
    return {
        "modalities": _modalities(),
        "samples": [
            {
                "id": s.id,
                "name": s.name,
                "modality": s.modality,
                "imageUrl": case_image_url(s.case_image_id) if s.case_image_id else None,
            }
            for s in rows
        ],
    }


class ReadingForm(BaseModel):
    sample_id: str | None = None
    modality: str = Field(min_length=1, max_length=50)
    opinion: str = Field(min_length=2, max_length=2000)


@bp.post("/ai/readings")
@auth_required()
def create_reading():
    """multipart：sampleId 或 file 二选一，加上 modality、opinion（学生判读意见，必填）。"""
    try:
        form = ReadingForm(
            sample_id=request.form.get("sampleId") or None,
            modality=(request.form.get("modality") or "").strip(),
            opinion=(request.form.get("opinion") or "").strip(),
        )
    except ValidationError as err:
        fields = {("opinion" if k == "opinion" else k): v for k, v in validation_error_fields(err).items()}
        raise ApiError(422, "validation_error", "请先填写你的判读意见。", fields) from err

    file = request.files.get("file")
    if bool(form.sample_id) == bool(file):
        raise ApiError(422, "validation_error", "请选择示例影像或上传一张图片。")

    user = me()
    sample = None
    upload = None
    if form.sample_id:
        sample = db.session.get(AiSample, form.sample_id)
        if sample is None:
            raise not_found("示例影像")
        modality = sample.modality
    else:
        modality = form.modality
        if modality not in _modalities():
            raise ApiError(422, "validation_error", "请选择检查类型。", {"modality": "无效的检查类型"})
        upload = media.save_upload(
            user.id, "ai_image", file,
            max_bytes=current_app.config["AI_IMAGE_MAX_BYTES"], allow_svg=False,
        )
        db.session.flush()

    reading = AiReading(
        user_id=user.id,
        sample_id=sample.id if sample else None,
        upload_id=upload.id if upload else None,
        modality=modality,
        student_opinion=form.opinion,
        result=ai_demo.analyze(modality, sample),
        result_source=ai_demo.RESULT_SOURCE,
        created_at=now_utc(),
    )
    db.session.add(reading)
    db.session.commit()
    return reading_dict(reading), 201


class AgreementBody(CamelModel):
    agreement: Literal["一致", "部分一致", "不一致"]


@bp.patch("/ai/readings/<reading_id>")
@auth_required()
def set_agreement(reading_id: str):
    """学生对照 AI 结果后，自评与 AI 结论的一致程度。"""
    rid = parse_uuid(reading_id)
    reading = db.session.get(AiReading, rid) if rid else None
    if reading is None or reading.user_id != me().id:
        raise not_found("判读记录")
    reading.agreement = parse_body(AgreementBody).agreement
    reading.agreed_at = now_utc()
    db.session.commit()
    return reading_dict(reading)


@bp.get("/ai/readings")
@auth_required()
def list_readings():
    user = me()
    page = max(request.args.get("page", 1, type=int), 1)
    page_size = min(max(request.args.get("pageSize", 10, type=int), 1), 50)
    conds = []
    # 学生只能看自己的；教师 / 管理员可看全部（mine=true 时只看自己的）
    if user.role == "student" or request.args.get("mine") == "true":
        conds.append(AiReading.user_id == user.id)
    total = db.session.scalar(select(func.count()).select_from(AiReading).where(*conds)) or 0
    rows = db.session.scalars(
        select(AiReading)
        .options(selectinload(AiReading.sample), selectinload(AiReading.user))
        .where(*conds)
        .order_by(AiReading.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"items": [reading_dict(r) for r in rows], "total": total, "page": page, "pageSize": page_size}
