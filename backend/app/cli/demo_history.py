"""演示学习记录：生成 / 清除。所有记录都标记 is_demo=true，清除时绝不触碰真实数据。"""

import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import click
from flask import current_app
from sqlalchemy import delete, select

from app.api.meta import current_semester, current_week
from app.extensions import db
from app.models import (
    AiReading,
    AiSample,
    Case,
    CaseView,
    PracticeAttempt,
    PracticeSession,
    Question,
    QuestionSet,
    SchoolClass,
    Upload,
    User,
)
from app.services import ai_demo
from app.services.media import delete_upload
from app.services.practice import grade
from app.services.timeutil import now_utc
from app.services.users import active_admin_count

OPINIONS = [
    "考虑为病灶所在部位的典型表现，建议结合增强扫描进一步明确。",
    "可见异常密度 / 信号影，边界欠清，需与炎性病变鉴别。",
    "病灶形态学特征较典型，倾向于该病种诊断。",
    "表现不太典型，建议结合临床病史及实验室检查。",
]
# 约 5 名学生投入少或正确率低，用于展示「需关注」
LOW_EFFORT = {4, 8, 13, 22, 27}


def _local(day: date, minutes: int, tz: ZoneInfo) -> datetime:
    return datetime.combine(day, time.min, tzinfo=tz) + timedelta(minutes=minutes)


def seed_history(seed: int = 42, now: datetime | None = None) -> dict[str, int]:
    """为演示学生生成本学期（第 1 周至今）的练习、浏览、判读记录；会先清除旧的演示记录。"""
    clear_demo_activity()
    rng = random.Random(seed)
    tz = ZoneInfo(current_app.config["APP_TZ"])
    now = now or now_utc()
    sem = current_semester()
    if sem is None:
        raise click.ClickException("请先运行 flask seed accounts 创建学期。")
    week_now = current_week(sem, now.astimezone(tz).date())

    students = db.session.scalars(
        select(User).where(User.is_demo.is_(True), User.role == "student").order_by(User.student_no)
    ).all()
    sets = db.session.scalars(
        select(QuestionSet).where(QuestionSet.is_published.is_(True)).order_by(QuestionSet.sort_order)
    ).all()
    pools = {
        s.id: db.session.scalars(
            select(Question)
            .where(Question.set_id == s.id, Question.is_active.is_(True))
            .order_by(Question.sort_order)
        ).all()
        for s in sets
    }
    case_ids = db.session.scalars(
        select(Case.id).where(Case.is_published.is_(True)).order_by(Case.sort_order)
    ).all()
    samples = db.session.scalars(select(AiSample).order_by(AiSample.sort_order)).all()
    if not case_ids or not sets:
        raise click.ClickException("请先运行 flask content import 导入教学内容。")

    counts = {"sessions": 0, "attempts": 0, "case_views": 0, "ai_readings": 0}
    for idx, student in enumerate(students, start=1):
        low = idx in LOW_EFFORT
        diligence = rng.uniform(0.25, 0.45) if low else rng.uniform(0.7, 1.2)
        skill = rng.uniform(0.42, 0.55) if low else rng.uniform(0.62, 0.9)

        for week in range(1, week_now + 1):
            factor = 0.45 if week == 4 else 1.0  # 第 4 周国庆假期
            week_start = sem.start_date + timedelta(days=(week - 1) * 7)

            def when() -> datetime | None:
                day = week_start + timedelta(days=rng.randrange(7))
                ts = _local(day, rng.randrange(8 * 60, 23 * 60 + 30), tz)
                return ts if ts <= now else None  # 不生成未来的记录

            # 练习：答对概率随技能与周次提升；作答由真实判分函数评判
            for _ in range(max(0, round(rng.gauss(2.2 * diligence * factor, 0.6)))):
                started = when()
                if started is None:
                    continue
                qset = rng.choices(sets, weights=[3 if s.kind == "case_diagnosis" else 1 for s in sets])[0]
                pool = pools[qset.id]
                if qset.session_size and len(pool) > qset.session_size:
                    chosen = rng.sample(pool, qset.session_size)
                else:
                    chosen = pool
                session = PracticeSession(
                    user_id=student.id, set_id=qset.id, status="finished",
                    question_count=len(chosen), started_at=started, is_demo=True,
                )
                db.session.add(session)
                db.session.flush()
                t, correct = started, 0
                p = min(0.95, skill + 0.012 * week)
                for pos, q in enumerate(chosen):
                    spent = rng.randint(20, 95)
                    t += timedelta(seconds=spent)
                    keys = [o["key"] for o in q.options]
                    if rng.random() < p:
                        selected = list(q.answer)
                    else:
                        wrong = [k for k in keys if k not in q.answer] or keys
                        selected = [rng.choice(wrong)]
                    ok = grade(q, selected)
                    correct += ok
                    db.session.add(
                        PracticeAttempt(
                            session_id=session.id, user_id=student.id, question_id=q.id,
                            position=pos, selected=sorted(selected), is_correct=ok,
                            answered_at=min(t, now), time_spent_ms=spent * 1000, is_demo=True,
                        )
                    )
                    counts["attempts"] += 1
                session.correct_count = correct
                session.finished_at = min(t + timedelta(seconds=20), now)
                session.duration_seconds = int((session.finished_at - started).total_seconds())
                counts["sessions"] += 1

            # 病例浏览
            for _ in range(max(0, round(rng.gauss(4.0 * diligence * factor, 1.0)))):
                ts = when()
                if ts is None:
                    continue
                db.session.add(
                    CaseView(
                        user_id=student.id, case_id=rng.choice(case_ids), viewed_at=ts,
                        duration_seconds=rng.randint(60, 900), is_demo=True,
                    )
                )
                counts["case_views"] += 1

            # AI 判读（示例影像；自评一致程度与技能相关）
            for _ in range(max(0, round(rng.gauss(1.2 * diligence * factor, 0.5)))):
                ts = when()
                if ts is None or not samples:
                    continue
                sample = rng.choice(samples)
                agreement = rng.choices(
                    ["一致", "部分一致", "不一致"], weights=[skill * 3, 1.2, (1 - skill) * 2]
                )[0]
                db.session.add(
                    AiReading(
                        user_id=student.id, sample_id=sample.id, modality=sample.modality,
                        student_opinion=rng.choice(OPINIONS),
                        result=ai_demo.analyze(sample.modality, sample),
                        result_source=ai_demo.RESULT_SOURCE, agreement=agreement,
                        agreed_at=min(ts + timedelta(minutes=2), now), created_at=ts, is_demo=True,
                    )
                )
                counts["ai_readings"] += 1
        db.session.flush()

    db.session.commit()
    return counts


def clear_demo_activity() -> dict[str, int]:
    """删除所有 is_demo 的学习记录与演示上传文件；真实数据（is_demo=false）不受影响。"""
    removed = {
        "ai_readings": db.session.execute(delete(AiReading).where(AiReading.is_demo.is_(True))).rowcount,
        "case_views": db.session.execute(delete(CaseView).where(CaseView.is_demo.is_(True))).rowcount,
        # 练习作答随练习级联删除
        "sessions": db.session.execute(
            delete(PracticeSession).where(PracticeSession.is_demo.is_(True))
        ).rowcount,
    }
    for upload in db.session.scalars(select(Upload).where(Upload.is_demo.is_(True))).all():
        delete_upload(upload)
    db.session.commit()
    return removed


def clear_demo_accounts() -> int:
    """删除演示账号与无人使用的演示班级（始终保留至少一个启用的管理员）。"""
    removed = 0
    for user in db.session.scalars(select(User).where(User.is_demo.is_(True))).all():
        if user.role == "admin" and user.status == "active" and active_admin_count(exclude=user.id) == 0:
            continue
        db.session.delete(user)
        removed += 1
    db.session.flush()
    for cls in db.session.scalars(select(SchoolClass).where(SchoolClass.is_demo.is_(True))).all():
        if not cls.students:
            db.session.delete(cls)
    db.session.commit()
    return removed
