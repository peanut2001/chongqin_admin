"""班级管理（仅管理员）。

GET    /classes        班级列表（含学生人数、授课学期）
POST   /classes        新建班级（自动加入当前学期的授课班级）
PATCH  /classes/:id    修改班级
DELETE /classes/:id    删除班级：班级内还有学生时拒绝（409），避免学生悄悄失去班级

所有登录用户需要的班级下拉数据仍由 GET /meta 提供；授课班级在学期管理中调整。
"""

from flask import Blueprint
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.meta import current_semester
from app.auth.decorators import auth_required, me
from app.errors import ApiError, not_found
from app.extensions import db
from app.models import SchoolClass, User
from app.schemas import CamelModel, parse_body
from app.services import audit
from app.services.timeutil import iso

bp = Blueprint("classes", __name__)


def student_counts() -> dict[int, int]:
    return dict(
        db.session.execute(
            select(User.class_id, func.count())
            .where(User.role == "student", User.class_id.is_not(None))
            .group_by(User.class_id)
        ).all()
    )


def class_dict(c: SchoolClass, student_count: int) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "cohortYear": c.cohort_year,
        "studentCount": student_count,
        "isDemo": c.is_demo,
        "createdAt": iso(c.created_at),
        "semesters": [{"id": s.id, "name": s.name, "isCurrent": s.is_current} for s in c.semesters],
    }


class ClassCreate(CamelModel):
    name: str = Field(min_length=1, max_length=50)
    cohort_year: int | None = Field(default=None, ge=2000, le=2100)


class ClassUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    cohort_year: int | None = Field(default=None, ge=2000, le=2100)


def _get_class(class_id: int) -> SchoolClass:
    cls = db.session.get(SchoolClass, class_id)
    if cls is None:
        raise not_found("班级")
    return cls


def _check_name(name: str, exclude: int | None = None) -> None:
    stmt = select(SchoolClass.id).where(SchoolClass.name == name)
    if exclude is not None:
        stmt = stmt.where(SchoolClass.id != exclude)
    if db.session.scalar(stmt) is not None:
        raise ApiError(409, "conflict", "班级名称已存在。", {"name": "班级名称已存在。"})


@bp.get("/classes")
@auth_required("admin")
def list_classes():
    counts = student_counts()
    rows = db.session.scalars(
        select(SchoolClass).options(selectinload(SchoolClass.semesters)).order_by(SchoolClass.name)
    ).all()
    return [class_dict(c, counts.get(c.id, 0)) for c in rows]


@bp.post("/classes")
@auth_required("admin")
def create_class():
    body = parse_body(ClassCreate)
    _check_name(body.name)
    cls = SchoolClass(name=body.name, cohort_year=body.cohort_year)
    db.session.add(cls)
    # 新班级默认参加当前学期，学情统计里能直接看到；不需要时在学期管理中取消
    sem = current_semester()
    if sem is not None:
        sem.classes.append(cls)
    db.session.flush()
    audit.log("class.create", me().id, "class", str(cls.id), {"name": cls.name})
    db.session.commit()
    return class_dict(cls, 0), 201


@bp.patch("/classes/<int:class_id>")
@auth_required("admin")
def update_class(class_id: int):
    cls = _get_class(class_id)
    data = parse_body(ClassUpdate).model_dump(exclude_unset=True)
    if data.get("name") is None:
        data.pop("name", None)
    if "name" in data:
        _check_name(data["name"], exclude=cls.id)
    for key, value in data.items():
        setattr(cls, key, value)
    audit.log("class.update", me().id, "class", str(cls.id), {"name": cls.name})
    db.session.commit()
    return class_dict(cls, student_counts().get(cls.id, 0))


@bp.delete("/classes/<int:class_id>")
@auth_required("admin")
def delete_class(class_id: int):
    cls = _get_class(class_id)
    count = student_counts().get(cls.id, 0)
    if count:
        raise ApiError(
            409,
            "class_not_empty",
            f"班级内还有 {count} 名学生，请先在用户管理中调整他们的班级。",
            extra={"studentCount": count},
        )
    audit.log("class.delete", me().id, "class", str(cls.id), {"name": cls.name})
    db.session.delete(cls)
    db.session.commit()
    return "", 204

