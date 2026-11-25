"""练习：抽题、判分、汇总。判分只在服务端进行，答案在提交前不会下发。"""

import random
import uuid
from datetime import timedelta

from sqlalchemy import func, select, update

from app.extensions import db
from app.models import PracticeAttempt, PracticeSession, Question, QuestionSet
from app.services.signing import question_image_token
from app.services.timeutil import now_utc

TYPE_LABELS = {"single": "单选题", "multiple": "多选题", "judge": "判断题"}
ABANDON_AFTER = timedelta(hours=3)
# 单次练习计入学习时长的上限，避免长时间挂机
MAX_SESSION_SECONDS = 60 * 60
# 题集正确率至少基于这么多次作答才展示，避免样本太少时误导
MIN_ATTEMPTS_FOR_ACCURACY = 20


def grade(question: Question, selected: list[str]) -> bool:
    return sorted(set(selected)) == sorted(question.answer)


def question_image_url(case_image_id: uuid.UUID) -> str:
    return f"/api/media/question-images/{question_image_token(case_image_id)}"


def public_question(q: Question) -> dict:
    """提交前可见的题目内容：不含答案、解析、病例 / 病种编号、图注。"""
    return {
        "id": str(q.id),
        "type": TYPE_LABELS[q.type],
        "stem": q.stem,
        "options": q.options,
        "presentation": q.presentation,
        "images": [{"url": question_image_url(qi.case_image_id)} for qi in q.images],
    }


def revealed(q: Question) -> dict:
    """提交后才返回：答案、解析、关联病例、带图注的配图。"""
    return {
        "answer": q.answer,
        "explanation": q.explanation,
        "caseId": q.case_id,
        "images": [
            {"url": question_image_url(qi.case_image_id), "caption": qi.case_image.caption}
            for qi in q.images
        ],
    }


def abandon_stale_sessions(user_id: uuid.UUID) -> None:
    db.session.execute(
        update(PracticeSession)
        .where(
            PracticeSession.user_id == user_id,
            PracticeSession.status == "in_progress",
            PracticeSession.started_at < now_utc() - ABANDON_AFTER,
        )
        .values(status="abandoned")
    )


def start_session(user_id: uuid.UUID, qset: QuestionSet, rng: random.Random | None = None) -> PracticeSession:
    abandon_stale_sessions(user_id)
    questions = db.session.scalars(
        select(Question)
        .where(Question.set_id == qset.id, Question.is_active.is_(True))
        .order_by(Question.sort_order)
    ).all()
    if qset.session_size and len(questions) > qset.session_size:
        questions = (rng or random).sample(list(questions), qset.session_size)

    session = PracticeSession(
        user_id=user_id, set_id=qset.id, question_count=len(questions), started_at=now_utc()
    )
    db.session.add(session)
    db.session.flush()
    db.session.add_all(
        PracticeAttempt(session_id=session.id, user_id=user_id, question_id=q.id, position=i)
        for i, q in enumerate(questions)
    )
    db.session.flush()
    return session


def finish_session(session: PracticeSession) -> None:
    attempts = session.attempts
    session.correct_count = sum(1 for a in attempts if a.is_correct)
    session.status = "finished"
    session.finished_at = now_utc()
    elapsed = int((session.finished_at - session.started_at).total_seconds())
    session.duration_seconds = max(0, min(elapsed, MAX_SESSION_SECONDS))


def set_accuracy(set_id: str) -> float | None:
    """题集的全体正确率（作答次数不足时为 None）。"""
    answered, correct = db.session.execute(
        select(func.count(), func.count().filter(PracticeAttempt.is_correct.is_(True)))
        .select_from(PracticeAttempt)
        .join(Question, Question.id == PracticeAttempt.question_id)
        .where(Question.set_id == set_id, PracticeAttempt.answered_at.is_not(None))
    ).one()
    if answered < MIN_ATTEMPTS_FOR_ACCURACY:
        return None
    return round(correct * 100 / answered, 1)
