"""学情统计：全部由行为记录实时计算（练习作答、病例浏览、AI 判读），统计范围为当前学期。

口径说明：
- 教学周：按 APP_TZ（北京时间）的日期计算，(日期 - 学期开始日) // 7 + 1；只统计第 1 周到当前周。
- practice：该周作答的题目数；accuracy：该周 正确数 / 作答数 × 100，无作答时为 None（图表显示空缺而非 0）。
- 学习时长：练习时长（每次练习最多计 60 分钟；未交卷的按每题 1 分钟估算）
           + 病例浏览时长（每次最多 30 分钟，未上报时长按 3 分钟计）+ 每次 AI 判读 5 分钟。
- 需关注：正确率 < ATTENTION_ACCURACY，或学习时长低于按学期进度折算的阈值
         （ATTENTION_HOURS_FULL_SEMESTER × 当前周 / ATTENTION_HOURS_REFERENCE_WEEKS），
         避免学期初所有人都被标记。
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from flask import current_app
from sqlalchemy import text

from app.extensions import db
from app.models import Semester
from app.services.timeutil import iso

AI_READING_SECONDS = 5 * 60
DEFAULT_VIEW_SECONDS = 3 * 60
MAX_VIEW_SECONDS = 30 * 60
MAX_SESSION_SECONDS = 60 * 60
ESTIMATED_SECONDS_PER_QUESTION = 60


def _name(row) -> str:
    """与 User.display_name 相同：中文「姓名」，西文「名 姓」。"""
    if any("一" <= ch <= "鿿" for ch in row.first_name + row.last_name):
        return f"{row.last_name}{row.first_name}" or row.username
    return f"{row.first_name} {row.last_name}".strip() or row.username


@dataclass
class Scope:
    """统计范围：某个班级（class_id）、全体学生（都为 None）或某一个用户（user_id）。"""

    class_id: int | None = None
    user_id: uuid.UUID | None = None

    def users_sql(self) -> str:
        if self.user_id is not None:
            return "SELECT CAST(:scope_user AS uuid) AS id"
        return (
            "SELECT id FROM users WHERE role = 'student' "
            "AND (CAST(:scope_class AS integer) IS NULL OR class_id = CAST(:scope_class AS integer))"
        )

    def params(self) -> dict:
        return {"scope_user": str(self.user_id) if self.user_id else None, "scope_class": self.class_id}


def _tz() -> str:
    return current_app.config["APP_TZ"]


def semester_window(sem: Semester, current_week: int) -> dict:
    tz = ZoneInfo(_tz())
    start = datetime.combine(sem.start_date, time.min, tzinfo=tz)
    return {"tz": _tz(), "start_date": sem.start_date, "start_ts": start, "current_week": current_week}


def _week_expr(col: str) -> str:
    return f"((timezone(:tz, {col}))::date - CAST(:start_date AS date)) / 7 + 1"


def weekly_activity(sem: Semester, current_week: int, scope: Scope) -> list[dict]:
    params = {**semester_window(sem, current_week), **scope.params()}
    sql = f"""
        WITH scope AS ({scope.users_sql()})
        SELECT w, SUM(practice) AS practice, SUM(correct) AS correct,
               SUM(views) AS views, SUM(ai) AS ai
        FROM (
            SELECT {_week_expr('answered_at')} AS w, 1 AS practice,
                   CASE WHEN is_correct THEN 1 ELSE 0 END AS correct, 0 AS views, 0 AS ai
            FROM practice_attempts
            WHERE answered_at IS NOT NULL AND answered_at >= :start_ts
              AND user_id IN (SELECT id FROM scope)
            UNION ALL
            SELECT {_week_expr('viewed_at')}, 0, 0, 1, 0 FROM case_views
            WHERE viewed_at >= :start_ts AND user_id IN (SELECT id FROM scope)
            UNION ALL
            SELECT {_week_expr('created_at')}, 0, 0, 0, 1 FROM ai_readings
            WHERE created_at >= :start_ts AND user_id IN (SELECT id FROM scope)
        ) t
        WHERE w BETWEEN 1 AND :current_week
        GROUP BY w
    """
    rows = {r.w: r for r in db.session.execute(text(sql), params)}
    result = []
    for week in range(1, current_week + 1):
        r = rows.get(week)
        practice = int(r.practice) if r else 0
        result.append(
            {
                "week": f"第{week}周",
                "weekIndex": week,
                "practice": practice,
                "caseViews": int(r.views) if r else 0,
                "aiReads": int(r.ai) if r else 0,
                "accuracy": round(int(r.correct) * 100 / practice) if practice else None,
            }
        )
    return result


def chapter_mastery(sem: Semester, current_week: int, scope: Scope) -> list[dict]:
    params = {**semester_window(sem, current_week), **scope.params()}
    sql = f"""
        WITH scope AS ({scope.users_sql()})
        SELECT qs.id AS set_id, qs.short_name, COUNT(*) AS answered,
               COUNT(*) FILTER (WHERE pa.is_correct) AS correct
        FROM practice_attempts pa
        JOIN questions q ON q.id = pa.question_id
        JOIN question_sets qs ON qs.id = q.set_id
        WHERE pa.answered_at IS NOT NULL AND pa.answered_at >= :start_ts
          AND pa.user_id IN (SELECT id FROM scope)
        GROUP BY qs.id, qs.short_name, qs.sort_order
        ORDER BY qs.sort_order
    """
    return [
        {"setId": r.set_id, "chapter": r.short_name, "mastery": round(r.correct * 100 / r.answered)}
        for r in db.session.execute(text(sql), params)
        if r.answered
    ]


def _seconds_sql() -> str:
    """每个用户在本学期的三类学习时长（秒）。"""
    return f"""
        practice AS (
            SELECT s.user_id, SUM(LEAST(COALESCE(s.duration_seconds,
                       (SELECT COUNT(*) * {ESTIMATED_SECONDS_PER_QUESTION} FROM practice_attempts a
                        WHERE a.session_id = s.id AND a.answered_at IS NOT NULL)), {MAX_SESSION_SECONDS})) AS secs
            FROM practice_sessions s
            WHERE s.started_at >= :start_ts AND s.user_id IN (SELECT id FROM scope)
            GROUP BY s.user_id
        ),
        views AS (
            SELECT user_id, COUNT(*) AS n, MAX(viewed_at) AS last,
                   SUM(LEAST(COALESCE(duration_seconds, {DEFAULT_VIEW_SECONDS}), {MAX_VIEW_SECONDS})) AS secs
            FROM case_views
            WHERE viewed_at >= :start_ts AND user_id IN (SELECT id FROM scope)
            GROUP BY user_id
        ),
        reads AS (
            SELECT user_id, COUNT(*) AS n, MAX(created_at) AS last
            FROM ai_readings
            WHERE created_at >= :start_ts AND user_id IN (SELECT id FROM scope)
            GROUP BY user_id
        ),
        answers AS (
            SELECT user_id, COUNT(*) AS n, COUNT(*) FILTER (WHERE is_correct) AS correct, MAX(answered_at) AS last
            FROM practice_attempts
            WHERE answered_at IS NOT NULL AND answered_at >= :start_ts AND user_id IN (SELECT id FROM scope)
            GROUP BY user_id
        )
    """


def module_usage(sem: Semester, current_week: int, scope: Scope) -> list[dict]:
    params = {**semester_window(sem, current_week), **scope.params()}
    sql = f"""
        WITH scope AS ({scope.users_sql()}), {_seconds_sql()}
        SELECT (SELECT COALESCE(SUM(secs), 0) FROM practice) AS practice,
               (SELECT COALESCE(SUM(secs), 0) FROM views) AS cases,
               (SELECT COALESCE(SUM(n), 0) FROM reads) AS ai_count
    """
    r = db.session.execute(text(sql), params).one()
    hours = lambda secs: round(float(secs) / 3600, 1)  # noqa: E731
    return [
        {"key": "cases", "name": "病例库浏览", "value": hours(r.cases)},
        {"key": "practice", "name": "题库练习", "value": hours(r.practice)},
        {"key": "ai", "name": "AI 图像判读", "value": hours(int(r.ai_count) * AI_READING_SECONDS)},
    ]


def attention_hours(current_week: int) -> float:
    cfg = current_app.config
    return round(
        cfg["ATTENTION_HOURS_FULL_SEMESTER"] * current_week / cfg["ATTENTION_HOURS_REFERENCE_WEEKS"], 1
    )


def student_stats(sem: Semester, current_week: int, scope: Scope) -> list[dict]:
    params = {**semester_window(sem, current_week), **scope.params()}
    sql = f"""
        WITH scope AS ({scope.users_sql()}), {_seconds_sql()}
        SELECT u.id, u.student_no, u.first_name, u.last_name, u.username, c.name AS class_name,
               COALESCE(a.n, 0) AS answered, COALESCE(a.correct, 0) AS correct,
               COALESCE(v.n, 0) AS views, COALESCE(r.n, 0) AS reads,
               COALESCE(p.secs, 0) + COALESCE(v.secs, 0) + COALESCE(r.n, 0) * {AI_READING_SECONDS} AS secs,
               GREATEST(a.last, v.last, r.last) AS last_active
        FROM users u
        LEFT JOIN classes c ON c.id = u.class_id
        LEFT JOIN answers a ON a.user_id = u.id
        LEFT JOIN views v ON v.user_id = u.id
        LEFT JOIN reads r ON r.user_id = u.id
        LEFT JOIN practice p ON p.user_id = u.id
        WHERE u.id IN (SELECT id FROM scope)
        ORDER BY u.student_no NULLS LAST, u.username
    """
    threshold_hours = attention_hours(current_week)
    min_accuracy = current_app.config["ATTENTION_ACCURACY"]
    result = []
    for r in db.session.execute(text(sql), params):
        accuracy = round(r.correct * 100 / r.answered) if r.answered else None
        hours = round(float(r.secs) / 3600, 1)
        name = _name(r)
        result.append(
            {
                "id": r.student_no or r.username,
                "userId": str(r.id),
                "name": name,
                "className": r.class_name,
                "studyHours": hours,
                "practiceCount": int(r.answered),
                "accuracy": accuracy,
                "caseViews": int(r.views),
                "aiReads": int(r.reads),
                "lastActive": iso(r.last_active),
                "needsAttention": (accuracy is not None and accuracy < min_accuracy) or hours < threshold_hours,
            }
        )
    return result


def recent_activities(sem: Semester, current_week: int, scope: Scope, limit: int = 10) -> list[dict]:
    params = {**semester_window(sem, current_week), **scope.params(), "limit": limit}
    sql = f"""
        WITH scope AS ({scope.users_sql()})
        SELECT * FROM (
            SELECT s.user_id, s.finished_at AS at, 'practice' AS kind, qs.name AS a, NULL AS b,
                   s.correct_count AS n1, s.question_count AS n2
            FROM practice_sessions s JOIN question_sets qs ON qs.id = s.set_id
            WHERE s.status = 'finished' AND s.finished_at >= :start_ts AND s.user_id IN (SELECT id FROM scope)
            UNION ALL
            SELECT v.user_id, v.viewed_at, 'case', t.title, t.modality || ' · ' || t.system, NULL, NULL
            FROM case_views v JOIN cases c ON c.id = v.case_id JOIN disease_topics t ON t.id = c.topic_id
            WHERE v.viewed_at >= :start_ts AND v.user_id IN (SELECT id FROM scope)
            UNION ALL
            SELECT r.user_id, r.created_at, 'ai', COALESCE(sa.name, '上传图像 · ' || r.modality), r.agreement, NULL, NULL
            FROM ai_readings r LEFT JOIN ai_samples sa ON sa.id = r.sample_id
            WHERE r.created_at >= :start_ts AND r.user_id IN (SELECT id FROM scope)
        ) x
        JOIN users u ON u.id = x.user_id
        ORDER BY x.at DESC
        LIMIT :limit
    """
    items = []
    for r in db.session.execute(text(sql), params):
        name = _name(r)
        if r.kind == "practice":
            rate = round(r.n1 * 100 / r.n2) if r.n2 else 0
            action, detail = f"完成「{r.a}」练习", f"{r.n1}/{r.n2} 题正确，正确率 {rate}%"
        elif r.kind == "case":
            action, detail = f"浏览病例「{r.a}」", r.b
        else:
            action, detail = "提交 AI 判读对照", f"{r.a}" + (f" · 自评{r.b}" if r.b else "")
        items.append({"name": name, "action": action, "detail": detail, "time": iso(r.at)})
    return items


def summarize(students: list[dict]) -> dict:
    """由学生明细汇总 KPI。"""
    n = len(students)
    answered = sum(s["practiceCount"] for s in students)
    accs = [(s["accuracy"], s["practiceCount"]) for s in students if s["accuracy"] is not None]
    weighted = sum(a * c for a, c in accs)
    return {
        "studentCount": n,
        "avgAccuracy": round(weighted / answered, 1) if answered else None,
        "totalPractice": answered,
        "totalCaseViews": sum(s["caseViews"] for s in students),
        "totalAiReads": sum(s["aiReads"] for s in students),
        "avgStudyHours": round(sum(s["studyHours"] for s in students) / n, 1) if n else 0,
        "needsAttention": sum(1 for s in students if s["needsAttention"]),
    }


def active_since(students: list[dict], since: datetime) -> int:
    since_iso = iso(since)
    return sum(1 for s in students if s["lastActive"] and s["lastActive"] >= since_iso)


def today_in_tz() -> date:
    return datetime.now(ZoneInfo(_tz())).date()
