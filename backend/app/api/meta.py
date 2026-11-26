"""前端需要的公共信息：当前学期（含按日期计算的当前教学周）、班级列表等。"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app
from sqlalchemy import func, select

from app.auth.decorators import auth_required
from app.extensions import db
from app.models import SchoolClass, Semester, User


def today_local() -> date:
    return datetime.now(ZoneInfo(current_app.config["APP_TZ"])).date()


def current_week(sem: Semester, today: date | None = None) -> int:
    """按日期计算当前教学周，限制在 [1, total_weeks]。"""
    today = today or today_local()
    week = (today - sem.start_date).days // 7 + 1
    return max(1, min(week, sem.total_weeks))


def semester_dict(sem: Semester | None) -> dict | None:
    if sem is None:
        return None
    return {
        "id": sem.id,
        "name": sem.name,
        "course": sem.course,
        "startDate": sem.start_date.isoformat(),
        "endDate": sem.end_date.isoformat(),
        "totalWeeks": sem.total_weeks,
        "currentWeek": current_week(sem),
    }


def current_semester() -> Semester | None:
    return db.session.scalar(select(Semester).where(Semester.is_current.is_(True)))


bp = Blueprint("meta", __name__)


@bp.get("/meta")
@auth_required()
def meta():
    counts = dict(
        db.session.execute(
            select(User.class_id, func.count())
            .where(User.role == "student", User.class_id.is_not(None))
            .group_by(User.class_id)
        ).all()
    )
    classes = db.session.scalars(select(SchoolClass).order_by(SchoolClass.name)).all()
    sem = current_semester()
    # 学情统计的班级下拉只列当前学期的授课班级；用户表单仍可选择全部班级
    in_semester = {c.id for c in sem.classes} if sem else set()
    return {
        "semester": semester_dict(sem),
        "classes": [
            {
                "id": c.id,
                "name": c.name,
                "studentCount": counts.get(c.id, 0),
                "inCurrentSemester": c.id in in_semester,
            }
            for c in classes
        ],
    }
