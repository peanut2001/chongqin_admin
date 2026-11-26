"""学情统计与仪表盘。班级 / 全体学生的数据只对教师与管理员开放（由后端判断，不依赖前端隐藏）。"""

from datetime import timedelta

from flask import Blueprint, request
from pydantic import Field
from sqlalchemy import distinct, func, select

from app.api.meta import current_semester, current_week, semester_dict
from app.auth.decorators import auth_required, me
from app.errors import ApiError, not_found
from app.extensions import db
from app.models import Case, DiseaseTopic, Question, QuestionSet, User, semester_classes
from app.schemas import CamelModel, parse_body
from app.services import learning_advice as advice
from app.services import stats as svc
from app.services.timeutil import now_utc
from app.services.users import parse_uuid

bp = Blueprint("stats", __name__)


def _semester_or_error():
    sem = current_semester()
    if sem is None:
        raise ApiError(409, "no_semester", "尚未设置当前学期。")
    return sem, current_week(sem)


def _class_scope() -> svc.Scope:
    class_id = request.args.get("classId", type=int)
    return svc.Scope(class_id=class_id)


@bp.get("/stats/overview")
@auth_required("admin", "teacher")
def overview():
    sem, week = _semester_or_error()
    scope = _class_scope()
    students = svc.student_stats(sem, week, scope)
    kpis = svc.summarize(students)
    kpis["activeStudents7d"] = svc.active_since(students, now_utc() - timedelta(days=7))
    kpis["attentionHoursThreshold"] = svc.attention_hours(week)
    return {
        "semester": semester_dict(sem),
        "kpis": kpis,
        "weeklyActivity": svc.weekly_activity(sem, week, scope),
        "chapterMastery": svc.chapter_mastery(sem, week, scope),
        "moduleUsage": svc.module_usage(sem, week, scope),
        "recentActivities": svc.recent_activities(sem, week, scope),
    }


@bp.get("/stats/students")
@auth_required("admin", "teacher")
def students():
    sem, week = _semester_or_error()
    return svc.student_stats(sem, week, _class_scope())


def _student_or_404(user_id: str) -> User:
    uid = parse_uuid(user_id)
    user = db.session.get(User, uid) if uid else None
    if user is None or user.role != "student":
        raise not_found("学生")
    return user


@bp.get("/stats/students/<user_id>")
@auth_required("admin", "teacher")
def student_detail(user_id: str):
    """单个学生的学情详情：明细、每周趋势、章节掌握度（含班级平均）、模块时长、AI 判读自评。"""
    sem, week = _semester_or_error()
    return advice.student_detail(sem, week, _student_or_404(user_id))


@bp.post("/stats/students/<user_id>/ai-advice")
@auth_required("admin", "teacher")
def student_ai_advice(user_id: str):
    """单人 AI 学情分析（未启用模型时为演示结果）。"""
    sem, week = _semester_or_error()
    user = _student_or_404(user_id)
    return advice.student_advice(sem, week, user, show_detail=me().role == "admin")


class GroupAdviceBody(CamelModel):
    user_ids: list[str] = Field(min_length=1, max_length=advice.MAX_GROUP)


@bp.post("/stats/ai-advice")
@auth_required("admin", "teacher")
def group_ai_advice():
    """群体 AI 学情分析：分析指定的一批学生（未启用模型时为演示结果）。"""
    sem, week = _semester_or_error()
    ids = [parse_uuid(u) for u in parse_body(GroupAdviceBody).user_ids]
    if any(u is None for u in ids):
        raise ApiError(422, "validation_error", "学生编号无效。")
    return advice.group_advice(sem, week, ids, show_detail=me().role == "admin")


@bp.get("/stats/me")
@auth_required()
def my_stats():
    sem, week = _semester_or_error()
    scope = svc.Scope(user_id=me().id)
    rows = svc.student_stats(sem, week, scope)
    return {
        "semester": semester_dict(sem),
        "kpis": svc.summarize(rows),
        "weeklyActivity": svc.weekly_activity(sem, week, scope),
        "chapterMastery": svc.chapter_mastery(sem, week, scope),
        "moduleUsage": svc.module_usage(sem, week, scope),
    }


@bp.get("/dashboard")
@auth_required()
def dashboard():
    """仪表盘：教师 / 管理员看全体学生，学生只看自己的学习数据。"""
    user = me()
    sem, week = _semester_or_error()
    is_staff = user.role in ("admin", "teacher")
    scope = svc.Scope() if is_staff else svc.Scope(user_id=user.id)

    published = Case.is_published.is_(True)
    case_count = db.session.scalar(select(func.count()).select_from(Case).where(published)) or 0
    system_count = db.session.scalar(
        select(func.count(distinct(DiseaseTopic.system)))
        .select_from(Case)
        .join(DiseaseTopic, DiseaseTopic.id == Case.topic_id)
        .where(published)
    ) or 0
    question_count = db.session.scalar(
        select(func.count()).select_from(Question).where(Question.is_active.is_(True))
    ) or 0
    set_count = db.session.scalar(
        select(func.count()).select_from(QuestionSet).where(QuestionSet.is_published.is_(True))
    ) or 0
    # 与学情统计口径一致：只数当前学期授课班级的在读学生
    student_count = db.session.scalar(
        select(func.count())
        .select_from(User)
        .where(
            User.role == "student",
            User.status == "active",
            User.class_id.in_(
                select(semester_classes.c.class_id).where(semester_classes.c.semester_id == sem.id)
            ),
        )
    ) or 0

    weekly = svc.weekly_activity(sem, week, scope)
    rows = svc.student_stats(sem, week, scope)
    body = {
        "semester": semester_dict(sem),
        "scope": "class" if is_staff else "personal",
        "caseCount": case_count,
        "systemCount": system_count,
        "questionCount": question_count,
        "questionSetCount": set_count,
        "studentCount": student_count,
        "kpis": svc.summarize(rows),
        "weeklyActivity": weekly,
    }
    if is_staff:
        body["recentActivities"] = svc.recent_activities(sem, week, scope)
        body["chapterMastery"] = svc.chapter_mastery(sem, week, scope)
        body["moduleUsage"] = svc.module_usage(sem, week, scope)
    return body
