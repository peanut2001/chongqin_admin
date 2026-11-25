"""题库与练习。

POST /practice-sessions          开始练习（服务端抽题，返回不含答案的题目）
POST /practice-sessions/:id/answers  提交一题，返回对错、答案、解析
POST /practice-sessions/:id/finish   交卷，返回成绩
GET  /practice-sessions          练习记录（学生只能看自己的）
"""

import uuid

from flask import Blueprint, request
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.auth.decorators import auth_required, me
from app.errors import ApiError, not_found
from app.extensions import db
from app.models import PracticeAttempt, PracticeSession, Question, QuestionImage, QuestionSet, User
from app.schemas import CamelModel, parse_body
from app.services import practice as svc
from app.services.timeutil import iso, now_utc
from app.services.users import parse_uuid

bp = Blueprint("practice", __name__)


class StartBody(CamelModel):
    set_id: str


class AnswerBody(CamelModel):
    question_id: str
    selected: list[str] = Field(min_length=1, max_length=10)
    time_spent_ms: int | None = Field(default=None, ge=0, le=3_600_000)


def _question_load():
    return selectinload(PracticeSession.attempts).selectinload(PracticeAttempt.question).selectinload(
        Question.images
    ).selectinload(QuestionImage.case_image)


def _own_session(session_id: str) -> PracticeSession:
    sid = parse_uuid(session_id)
    session = (
        db.session.scalar(
            select(PracticeSession).options(_question_load()).where(PracticeSession.id == sid)
        )
        if sid
        else None
    )
    # 别人的练习一律当作不存在
    if session is None or session.user_id != me().id:
        raise not_found("练习")
    return session


@bp.get("/question-sets")
@auth_required()
def list_sets():
    user = me()
    sets = db.session.scalars(
        select(QuestionSet).where(QuestionSet.is_published.is_(True)).order_by(QuestionSet.sort_order)
    ).all()
    totals = dict(
        db.session.execute(
            select(Question.set_id, func.count())
            .where(Question.is_active.is_(True))
            .group_by(Question.set_id)
        ).all()
    )
    mine = {
        row.set_id: (row.answered, row.correct)
        for row in db.session.execute(
            select(
                Question.set_id,
                func.count().label("answered"),
                func.count().filter(PracticeAttempt.is_correct.is_(True)).label("correct"),
            )
            .join(Question, Question.id == PracticeAttempt.question_id)
            .where(PracticeAttempt.user_id == user.id, PracticeAttempt.answered_at.is_not(None))
            .group_by(Question.set_id)
        )
    }
    result = []
    for s in sets:
        answered, correct = mine.get(s.id, (0, 0))
        result.append(
            {
                "id": s.id,
                "name": s.name,
                "shortName": s.short_name,
                "description": s.description,
                "kind": s.kind,
                "total": totals.get(s.id, 0),
                "sessionSize": s.session_size,
                "avgAccuracy": svc.set_accuracy(s.id),
                "my": {
                    "answered": answered,
                    "accuracy": round(correct * 100 / answered, 1) if answered else None,
                },
            }
        )
    return result


@bp.post("/practice-sessions")
@auth_required()
def start():
    body = parse_body(StartBody)
    qset = db.session.get(QuestionSet, body.set_id)
    if qset is None or not qset.is_published:
        raise not_found("题集")
    session = svc.start_session(me().id, qset)
    db.session.commit()
    session = _own_session(str(session.id))
    return {
        "id": str(session.id),
        "set": {"id": qset.id, "name": qset.name},
        "startedAt": iso(session.started_at),
        "questions": [svc.public_question(a.question) for a in session.attempts],
    }, 201


@bp.post("/practice-sessions/<session_id>/answers")
@auth_required()
def answer(session_id: str):
    session = _own_session(session_id)
    if session.status != "in_progress":
        raise ApiError(409, "session_closed", "本次练习已结束。")
    body = parse_body(AnswerBody)
    qid = parse_uuid(body.question_id)
    attempt = next((a for a in session.attempts if a.question_id == qid), None)
    if attempt is None:
        raise ApiError(422, "validation_error", "该题不属于本次练习。", {"questionId": "无效的题目"})
    q = attempt.question

    # 已作答则直接返回原结果（幂等，不允许改答案）
    if attempt.answered_at is None:
        keys = {o["key"] for o in q.options}
        selected = sorted(set(body.selected))
        if not set(selected) <= keys:
            raise ApiError(422, "validation_error", "选项无效。", {"selected": "选项无效"})
        if q.type in ("single", "judge") and len(selected) != 1:
            raise ApiError(422, "validation_error", "该题只能选择一个答案。", {"selected": "只能选一个"})
        attempt.selected = selected
        attempt.is_correct = svc.grade(q, selected)
        attempt.answered_at = now_utc()
        attempt.time_spent_ms = body.time_spent_ms
        db.session.commit()

    return {
        "questionId": str(q.id),
        "selected": attempt.selected,
        "correct": bool(attempt.is_correct),
        **svc.revealed(q),
    }


@bp.post("/practice-sessions/<session_id>/finish")
@auth_required()
def finish(session_id: str):
    session = _own_session(session_id)
    if session.status == "in_progress":
        svc.finish_session(session)
        db.session.commit()
    return {
        "id": str(session.id),
        "score": round(session.correct_count * 100 / session.question_count) if session.question_count else 0,
        "correctCount": session.correct_count,
        "questionCount": session.question_count,
        "durationSeconds": session.duration_seconds,
        "classAvgAccuracy": svc.set_accuracy(session.set_id),
        "items": [
            {
                "questionId": str(a.question_id),
                "stem": a.question.stem,
                "selected": a.selected or [],
                "answer": a.question.answer,
                "correct": bool(a.is_correct),
            }
            for a in session.attempts
        ],
    }


@bp.get("/practice-sessions")
@auth_required()
def list_sessions():
    user = me()
    page = max(request.args.get("page", 1, type=int), 1)
    page_size = min(max(request.args.get("pageSize", 10, type=int), 1), 100)
    conds = [PracticeSession.status == "finished"]
    if user.role == "student":
        conds.append(PracticeSession.user_id == user.id)
    elif request.args.get("userId"):
        uid = parse_uuid(request.args["userId"])
        conds.append(PracticeSession.user_id == (uid or uuid.uuid4()))
    if request.args.get("setId"):
        conds.append(PracticeSession.set_id == request.args["setId"])

    total = db.session.scalar(select(func.count()).select_from(PracticeSession).where(*conds)) or 0
    rows = db.session.execute(
        select(PracticeSession, User, QuestionSet.name)
        .join(User, User.id == PracticeSession.user_id)
        .join(QuestionSet, QuestionSet.id == PracticeSession.set_id)
        .where(*conds)
        .order_by(PracticeSession.finished_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [
            {
                "id": str(s.id),
                "student": {
                    "id": str(u.id),
                    "name": u.display_name,
                    "studentNo": u.student_no,
                },
                "setName": set_name,
                "count": s.question_count,
                "correct": s.correct_count,
                "durationSeconds": s.duration_seconds,
                "finishedAt": iso(s.finished_at),
            }
            for s, u, set_name in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }
