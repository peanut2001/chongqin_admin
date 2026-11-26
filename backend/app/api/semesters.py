"""学期管理（仅管理员）。

GET    /semesters                 学期列表（最新的在前，含授课班级）
POST   /semesters                 新建学期（系统中还没有当前学期时，自动设为当前学期）
PATCH  /semesters/:id             修改学期
POST   /semesters/:id/activate    设为当前学期（同一时间只有一个当前学期）
DELETE /semesters/:id             删除学期（当前学期不能删除）

授课班级（classIds）决定学情统计包含哪些学生；新建时不传则默认全部班级，修改时不传则保持不变。
学习记录不关联学期，统计时按当前学期的起止日期与授课班级筛选，所以切换 / 删除学期不会删除任何学习数据。
"""

import math
from datetime import date

from flask import Blueprint
from pydantic import Field
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.api.classes import student_counts
from app.api.meta import semester_dict
from app.auth.decorators import auth_required, me
from app.errors import ApiError, not_found
from app.extensions import db
from app.models import SchoolClass, Semester
from app.schemas import CamelModel, parse_body
from app.services import audit

bp = Blueprint("semesters", __name__)

MAX_WEEKS = 30


class SemesterCreate(CamelModel):
    name: str = Field(min_length=1, max_length=50)
    course: str = Field(min_length=1, max_length=100)
    start_date: date
    end_date: date
    # 留空则按起止日期自动计算
    total_weeks: int | None = Field(default=None, ge=1, le=MAX_WEEKS)
    set_current: bool = False
    # 授课班级；不传则默认全部班级
    class_ids: list[int] | None = None


class SemesterUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    course: str | None = Field(default=None, min_length=1, max_length=100)
    start_date: date | None = None
    end_date: date | None = None
    total_weeks: int | None = Field(default=None, ge=1, le=MAX_WEEKS)
    # 授课班级；不传则保持不变
    class_ids: list[int] | None = None


def covered_weeks(start: date, end: date) -> int:
    """起止日期（含两端）覆盖的周数。"""
    return math.ceil(((end - start).days + 1) / 7)


def _resolve_weeks(start: date, end: date, total_weeks: int | None) -> int:
    if end <= start:
        raise ApiError(422, "validation_error", "结束日期必须晚于开始日期。", {"endDate": "结束日期必须晚于开始日期。"})
    covered = covered_weeks(start, end)
    if total_weeks is None:
        if covered > MAX_WEEKS:
            raise ApiError(
                422, "validation_error", f"学期最长 {MAX_WEEKS} 周。", {"endDate": f"学期最长 {MAX_WEEKS} 周。"}
            )
        return covered
    if total_weeks > covered:
        message = f"起止日期只覆盖 {covered} 周，教学周数不能超过 {covered}。"
        raise ApiError(422, "validation_error", message, {"totalWeeks": message})
    return total_weeks


def _dict(sem: Semester, counts: dict[int, int] | None = None) -> dict:
    counts = student_counts() if counts is None else counts
    return {
        **semester_dict(sem),
        "isCurrent": sem.is_current,
        "classes": [{"id": c.id, "name": c.name, "studentCount": counts.get(c.id, 0)} for c in sem.classes],
    }


def _resolve_classes(class_ids: list[int] | None) -> list[SchoolClass]:
    """None 表示全部班级；有不存在的班级时报 422。"""
    stmt = select(SchoolClass).order_by(SchoolClass.name)
    if class_ids is None:
        return list(db.session.scalars(stmt).all())
    ids = set(class_ids)
    rows = list(db.session.scalars(stmt.where(SchoolClass.id.in_(ids))).all())
    if len(rows) != len(ids):
        message = "授课班级不存在，请刷新后重试。"
        raise ApiError(422, "validation_error", message, {"classIds": message})
    return rows


def _get(semester_id: int) -> Semester:
    sem = db.session.get(Semester, semester_id)
    if sem is None:
        raise not_found("学期")
    return sem


def _make_current(sem: Semester) -> None:
    # 先取消其他学期（部分唯一索引保证同一时间只有一个当前学期）
    db.session.execute(
        update(Semester).where(Semester.is_current.is_(True), Semester.id != sem.id).values(is_current=False)
    )
    db.session.flush()
    sem.is_current = True


@bp.get("/semesters")
@auth_required("admin")
def list_semesters():
    rows = db.session.scalars(
        select(Semester)
        .options(selectinload(Semester.classes))
        .order_by(Semester.start_date.desc(), Semester.id.desc())
    ).all()
    counts = student_counts()
    return [_dict(s, counts) for s in rows]


@bp.post("/semesters")
@auth_required("admin")
def create_semester():
    body = parse_body(SemesterCreate)
    weeks = _resolve_weeks(body.start_date, body.end_date, body.total_weeks)
    sem = Semester(
        name=body.name,
        course=body.course,
        start_date=body.start_date,
        end_date=body.end_date,
        total_weeks=weeks,
        classes=_resolve_classes(body.class_ids),
    )
    db.session.add(sem)
    db.session.flush()
    has_current = db.session.scalar(
        select(Semester.id).where(Semester.is_current.is_(True), Semester.id != sem.id)
    )
    if body.set_current or has_current is None:
        _make_current(sem)
    audit.log("semester.create", me().id, "semester", str(sem.id), {"name": sem.name, "current": sem.is_current})
    db.session.commit()
    return _dict(sem), 201


@bp.patch("/semesters/<int:semester_id>")
@auth_required("admin")
def update_semester(semester_id: int):
    sem = _get(semester_id)
    data = {k: v for k, v in parse_body(SemesterUpdate).model_dump(exclude_unset=True).items() if v is not None}
    class_ids = data.pop("class_ids", None)
    if class_ids is not None:
        sem.classes = _resolve_classes(class_ids)
    start = data.get("start_date", sem.start_date)
    end = data.get("end_date", sem.end_date)
    if "total_weeks" in data:
        weeks = data["total_weeks"]
    elif "start_date" in data or "end_date" in data:
        weeks = None  # 改了日期但没给周数：按新日期重新计算
    else:
        weeks = sem.total_weeks
    data["total_weeks"] = _resolve_weeks(start, end, weeks)
    for key, value in data.items():
        setattr(sem, key, value)
    audit.log("semester.update", me().id, "semester", str(sem.id), {"name": sem.name})
    db.session.commit()
    return _dict(sem)


@bp.post("/semesters/<int:semester_id>/activate")
@auth_required("admin")
def activate_semester(semester_id: int):
    sem = _get(semester_id)
    if not sem.is_current:
        _make_current(sem)
        audit.log("semester.activate", me().id, "semester", str(sem.id), {"name": sem.name})
        db.session.commit()
    return _dict(sem)


@bp.delete("/semesters/<int:semester_id>")
@auth_required("admin")
def delete_semester(semester_id: int):
    sem = _get(semester_id)
    if sem.is_current:
        raise ApiError(409, "semester_current", "不能删除当前学期，请先把其他学期设为当前学期。")
    audit.log("semester.delete", me().id, "semester", str(sem.id), {"name": sem.name})
    db.session.delete(sem)
    db.session.commit()
    return "", 204
