"""AI 学情分析：群体分析（一批学生）与单人分析（一个学生），面向带教老师。

- 已启用 AI 模型（见 ai_model）时调用模型生成；未启用时按规则生成演示结果，结构相同。
- 隐私：发给模型的数据不含姓名、学号；群体分析用「学生1、学生2…」代号，结果返回后再换回学号与姓名。
- 结果不入库，由前端缓存。
"""

import json
import re
from datetime import datetime

from flask import current_app
from pydantic import BaseModel, ValidationError

from app.errors import ApiError
from app.models import Semester, User
from app.services import ai_model
from app.services import stats as svc
from app.services.timeutil import iso, now_utc

DEMO_DISCLAIMER = "演示结果：未启用 AI 模型，以下内容由规则根据学情数据生成，仅用于功能演示。"
MODEL_DISCLAIMER = "AI 生成内容仅供教学参考，请结合学生的实际情况判断。"

MAX_GROUP = 500

# ===== 公共 =====


def _idle_days(last_active: str | None) -> int | None:
    if not last_active:
        return None
    t = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
    return max(0, (now_utc() - t).days)


def _per_capita(rows: list[dict]) -> dict:
    """人均指标（正确率按题数加权）。"""
    k = svc.summarize(rows)
    n = k["studentCount"] or 1
    return {
        "studyHours": k["avgStudyHours"],
        "practiceCount": round(k["totalPractice"] / n, 1),
        "accuracy": k["avgAccuracy"],
        "caseViews": round(k["totalCaseViews"] / n, 1),
        "aiReads": round(k["totalAiReads"] / n, 1),
    }


def _rules() -> dict:
    return {"minAccuracy": current_app.config["ATTENTION_ACCURACY"]}


def _envelope(result: dict, demo: bool) -> dict:
    return {
        **result,
        "isDemo": demo,
        "modelName": None if demo else current_app.config["AI_MODEL_DISPLAY_NAME"],
        "disclaimer": DEMO_DISCLAIMER if demo else MODEL_DISCLAIMER,
        "generatedAt": iso(now_utc()),
    }


def _clean(items: list[str], limit: int, size: int = 200) -> list[str]:
    return [s.strip()[:size] for s in items if s and s.strip()][:limit]


def _dump(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1)


def _student_brief(r: dict) -> dict:
    """单个学生的匿名指标（不含姓名、学号）。"""
    return {
        "学习时长h": r["studyHours"],
        "练习题数": r["practiceCount"],
        "正确率%": r["accuracy"],
        "病例浏览": r["caseViews"],
        "AI判读": r["aiReads"],
        "距上次学习天数": _idle_days(r["lastActive"]),
        "需关注": r["needsAttention"],
    }


COMMON_RULES = """
数据口径：
- 统计范围为本学期第 1 周到当前周；学习时长 = 练习 + 病例浏览 + AI 判读的折算时长。
- 「需关注」：正确率低于 {min_acc}%，或学习时长低于按学期进度折算的阈值（当前为 {hours} 小时）。
- 正确率为 null 表示还没有作答；距上次学习天数为 null 表示本学期没有学习记录。
要求：只依据给出的数据，不要编造数据中没有的信息；语言简洁具体；全部使用简体中文；只输出一个 JSON 对象，不要输出其他文字或 Markdown 代码块。"""


# ===== 群体分析 =====

GROUP_SYSTEM = """你是医学影像教学平台的教学分析助手，帮助带教老师解读一批医学研究生的学情数据，结果仅供教学参考。

输出格式：
{
  "summary": "整体结论，1～2 句，点出最主要的特点或问题",
  "issues": [{"title": "问题概括（10 字以内）", "detail": "数据依据与说明，1～2 句"}],
  "focusStudents": [{"code": "学生3", "reason": "需要关注的原因，1 句，附数据"}],
  "suggestions": ["面向老师的教学建议，具体可执行（如针对哪个章节、采用什么形式）"]
}
- issues 2～4 条，按重要程度排序；整体表现好时也可以写值得保持的方面。
- focusStudents 最多 5 人，只能从给出的代号中选；没有明显需要关注的学生时为空数组。
- suggestions 2～4 条。"""


class _Issue(BaseModel):
    title: str
    detail: str = ""


class _Focus(BaseModel):
    code: str
    reason: str = ""


class _GroupResult(BaseModel):
    summary: str = ""
    issues: list[_Issue] = []
    focusStudents: list[_Focus] = []  # noqa: N815
    suggestions: list[str] = []


def group_advice(sem: Semester, week: int, user_ids: list, show_detail: bool = False) -> dict:
    scope = svc.Scope(user_ids=user_ids)
    rows = svc.student_stats(sem, week, scope)
    if not rows:
        raise ApiError(422, "empty_scope", "所选范围内没有学生。")
    chapters = svc.chapter_mastery(sem, week, scope)
    baseline = _per_capita(svc.student_stats(sem, week, svc.Scope()))
    threshold = svc.attention_hours(week)

    cfg = ai_model.active_config()
    if cfg is None:
        return _envelope(_demo_group(rows, chapters, baseline, threshold), demo=True)

    codes = {f"学生{i + 1}": r for i, r in enumerate(rows)}
    data = {
        "当前教学周": week,
        "本组人数": len(rows),
        "本组人均": _per_capita(rows),
        "全体学生人均（对比基准）": baseline,
        "本组章节掌握度%": {c["chapter"]: c["mastery"] for c in chapters},
        "学生明细": {code: _student_brief(r) for code, r in codes.items()},
    }
    system = GROUP_SYSTEM + COMMON_RULES.format(min_acc=_rules()["minAccuracy"], hours=threshold)
    text = ai_model.complete_text(cfg, system, "请分析以下学情数据：\n" + _dump(data), show_detail)
    try:
        raw = _GroupResult.model_validate(ai_model.extract_json(text, "分析结果"))
    except ValidationError as exc:
        raise ApiError(502, "ai_model_error", "模型返回的分析结果格式不正确，请重试或更换模型。") from exc

    def real(s: str) -> str:
        """把文字里的代号（学生3）换回姓名，老师才看得懂。"""
        return re.sub(
            r"学生\s*(\d+)",
            lambda m: codes[f"学生{m.group(1)}"]["name"] if f"学生{m.group(1)}" in codes else m.group(0),
            s,
        )

    focus = []
    for f in raw.focusStudents:
        m = re.search(r"\d+", f.code)
        r = codes.get(f"学生{m.group()}") if m else None
        if r and all(x["userId"] != r["userId"] for x in focus):
            focus.append(_focus_item(r, real(f.reason.strip()[:200])))
    return _envelope(
        {
            "summary": real(raw.summary.strip()[:500]) or "暂无结论。",
            "issues": [
                {"title": real(i.title.strip()[:30]), "detail": real(i.detail.strip()[:300])}
                for i in raw.issues
                if i.title.strip()
            ][:5],
            "focusStudents": focus[:5],
            "suggestions": [real(s) for s in _clean(raw.suggestions, 5)],
        },
        demo=False,
    )


def _focus_item(r: dict, reason: str) -> dict:
    return {"userId": r["userId"], "studentNo": r["id"], "name": r["name"], "reason": reason}


def _demo_group(rows: list[dict], chapters: list[dict], baseline: dict, threshold: float) -> dict:
    min_acc = _rules()["minAccuracy"]
    mine = _per_capita(rows)
    n = len(rows)
    answered = [r for r in rows if r["accuracy"] is not None]
    low_acc = [r for r in answered if r["accuracy"] < min_acc]
    low_hours = [r for r in rows if r["studyHours"] < threshold]
    idle = [r for r in rows if (d := _idle_days(r["lastActive"])) is None or d >= 7]
    unanswered = [r for r in rows if r["accuracy"] is None]
    weak = sorted((c for c in chapters if c["mastery"] < 75), key=lambda c: c["mastery"])[:2]

    issues: list[dict] = []
    tips: list[str] = []
    if low_hours:
        least = min(low_hours, key=lambda r: r["studyHours"])
        issues.append({
            "title": "学习时长不足",
            "detail": f"{len(low_hours)} 人学习时长低于当前进度要求的 {threshold} 小时，最少的仅 {least['studyHours']} 小时。",
        })
        tips.append("对学时不足的学生单独提醒，建议每周固定安排 2～3 次、每次 30 分钟以上的平台学习。")
    if low_acc:
        issues.append({
            "title": "正确率偏低",
            "detail": f"{len(low_acc)} 人正确率低于 {min_acc}%，最低为 {min(r['accuracy'] for r in low_acc)}%。",
        })
        tips.append("组织一次错题讲评，并让正确率偏低的学生先复习病例库中的对应病例再做练习。")
    if weak:
        names = "、".join(f"「{c['chapter']}」{c['mastery']}%" for c in weak)
        issues.append({"title": "章节掌握薄弱", "detail": f"本组掌握度较低的章节：{names}。"})
        tips.append(f"针对「{weak[0]['chapter']}」安排一次专项练习或典型病例讲解。")
    if idle:
        issues.append({"title": "近期学习中断", "detail": f"{len(idle)} 人近 7 天没有学习记录。"})
        tips.append("通过班级群或带教老师了解近期未学习学生的情况，必要时个别督促。")
    if unanswered:
        issues.append({"title": "尚未开始练习", "detail": f"{len(unanswered)} 人本学期还没有练习作答记录。"})
    if baseline["caseViews"] and mine["caseViews"] < baseline["caseViews"] * 0.7:
        issues.append({
            "title": "病例浏览偏少",
            "detail": f"人均浏览病例 {mine['caseViews']} 次，低于全体人均 {baseline['caseViews']} 次。",
        })
        tips.append("引导学生在练习后浏览相关病例，把做题和读片结合起来。")
    if not issues:
        issues.append({
            "title": "整体表现良好",
            "detail": f"人均学时 {mine['studyHours']} 小时、平均正确率 {mine['accuracy'] or '—'}%，暂无明显短板。",
        })
    tips += [
        "保持当前节奏，可适当增加综合性更强的练习和 AI 判读对照训练。",
        "建议每两周查看一次学情变化，及时发现掉队的学生。",
    ]

    focus_rows = sorted(
        {r["userId"]: r for r in [*[r for r in rows if r["needsAttention"]], *idle]}.values(),
        key=lambda r: (r["accuracy"] if r["accuracy"] is not None else -1, r["studyHours"]),
    )[:5]
    focus = []
    for r in focus_rows:
        parts = []
        if r["accuracy"] is None:
            parts.append("还没有作答记录")
        elif r["accuracy"] < min_acc:
            parts.append(f"正确率 {r['accuracy']}%")
        if r["studyHours"] < threshold:
            parts.append(f"学时仅 {r['studyHours']} 小时")
        d = _idle_days(r["lastActive"])
        if d is None:
            parts.append("本学期没有学习记录")
        elif d >= 7:
            parts.append(f"已 {d} 天未学习")
        focus.append(_focus_item(r, "，".join(parts) + "。"))

    acc = f"{mine['accuracy']}%" if mine["accuracy"] is not None else "—"
    summary = (
        f"本组 {n} 名学生，平均正确率 {acc}（全体 {baseline['accuracy'] or '—'}%），"
        f"人均学时 {mine['studyHours']} 小时（全体 {baseline['studyHours']} 小时）。"
    )
    attention = sum(1 for r in rows if r["needsAttention"])
    summary += f"其中 {attention} 人需关注，主要问题是{issues[0]['title']}。" if attention else "整体状态良好，暂无需关注学生。"
    return {
        "summary": summary,
        "issues": issues[:4],
        "focusStudents": focus,
        "suggestions": list(dict.fromkeys(tips))[:4],
    }


# ===== 单人：详情 =====


def student_detail(sem: Semester, week: int, user: User) -> dict:
    scope = svc.Scope(user_id=user.id)
    row = svc.student_stats(sem, week, scope)[0]
    peer_scope = svc.Scope(class_id=user.class_id) if user.class_id else svc.Scope()
    peers = svc.student_stats(sem, week, peer_scope)
    mine = {c["setId"]: c["mastery"] for c in svc.chapter_mastery(sem, week, scope)}
    chapters = [
        {"setId": c["setId"], "chapter": c["chapter"], "mastery": mine.get(c["setId"]), "peerMastery": c["mastery"]}
        for c in svc.chapter_mastery(sem, week, peer_scope)
    ]
    return {
        "student": row,
        "currentWeek": week,
        "attentionHoursThreshold": svc.attention_hours(week),
        "attentionAccuracy": _rules()["minAccuracy"],
        "peerLabel": "班级平均" if user.class_id else "全体平均",
        "peer": _per_capita(peers),
        "weeklyActivity": svc.weekly_activity(sem, week, scope),
        "chapterMastery": chapters,
        "moduleUsage": svc.module_usage(sem, week, scope),
        "aiAgreement": svc.ai_agreement(sem, week, scope),
    }


# ===== 单人：分析 =====

STUDENT_SYSTEM = """你是医学影像教学平台的教学分析助手，帮助带教老师解读某一位医学研究生的学情数据，结果仅供教学参考。

输出格式：
{
  "summary": "总体评价，1～2 句",
  "strengths": ["优势，附数据依据"],
  "weaknesses": ["薄弱点，附数据依据"],
  "suggestions": ["面向老师的辅导建议，具体可执行"],
  "message": "写给学生本人的一段学习建议：第二人称，语气鼓励、具体，80～150 字，不要出现姓名"
}
- strengths 0～3 条，weaknesses 1～4 条，suggestions 2～4 条。
- 可结合每周趋势判断学习状态的变化，结合章节掌握度与班级平均的差距指出具体章节。
- AI 判读自评：学生对照 AI 判读结果后自评「一致 / 部分一致 / 不一致」，不一致比例高说明读片能力有待提升。"""


class _StudentResult(BaseModel):
    summary: str = ""
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []
    message: str = ""


def student_advice(sem: Semester, week: int, user: User, show_detail: bool = False) -> dict:
    d = student_detail(sem, week, user)
    cfg = ai_model.active_config()
    if cfg is None:
        return _envelope(_demo_student(d), demo=True)

    data = {
        "当前教学周": week,
        "该生": _student_brief(d["student"]),
        f"{d['peerLabel']}（对比基准）": d["peer"],
        "每周学习（最近 8 周）": [
            {"周": w["weekIndex"], "练习题数": w["practice"], "正确率%": w["accuracy"],
             "病例浏览": w["caseViews"], "AI判读": w["aiReads"]}
            for w in d["weeklyActivity"][-8:]
        ],
        "章节掌握度%（该生 / 对比基准，该生为 null 表示未练习）": {
            c["chapter"]: [c["mastery"], c["peerMastery"]] for c in d["chapterMastery"]
        },
        "各模块学习时长h": {m["name"]: m["value"] for m in d["moduleUsage"]},
        "AI判读自评": d["aiAgreement"],
    }
    system = STUDENT_SYSTEM + COMMON_RULES.format(
        min_acc=d["attentionAccuracy"], hours=d["attentionHoursThreshold"]
    )
    text = ai_model.complete_text(cfg, system, "请分析以下学情数据：\n" + _dump(data), show_detail)
    try:
        raw = _StudentResult.model_validate(ai_model.extract_json(text, "分析结果"))
    except ValidationError as exc:
        raise ApiError(502, "ai_model_error", "模型返回的分析结果格式不正确，请重试或更换模型。") from exc
    return _envelope(
        {
            "summary": raw.summary.strip()[:500] or "暂无结论。",
            "strengths": _clean(raw.strengths, 4),
            "weaknesses": _clean(raw.weaknesses, 5),
            "suggestions": _clean(raw.suggestions, 5),
            "message": raw.message.strip()[:600],
        },
        demo=False,
    )


def _trend(weeks: list[dict]) -> int | None:
    """最近两周与之前各周的正确率差（按题数加权），数据不足时为 None。"""
    answered = [w for w in weeks if w["accuracy"] is not None and w["practice"]]
    if len(answered) < 4:
        return None

    def avg(ws):
        n = sum(w["practice"] for w in ws)
        return sum(w["accuracy"] * w["practice"] for w in ws) / n

    return round(avg(answered[-2:]) - avg(answered[:-2]))


def _demo_student(d: dict) -> dict:
    s, peer = d["student"], d["peer"]
    min_acc, threshold = d["attentionAccuracy"], d["attentionHoursThreshold"]
    acc, hours, idle = s["accuracy"], s["studyHours"], _idle_days(s["lastActive"])
    practiced = [c for c in d["chapterMastery"] if c["mastery"] is not None]
    missing = [c for c in d["chapterMastery"] if c["mastery"] is None]
    trend = _trend(d["weeklyActivity"])
    agree = d["aiAgreement"]
    rated = agree["一致"] + agree["部分一致"] + agree["不一致"]

    strengths: list[str] = []
    # (薄弱点, 给老师的建议, 给学生的建议)
    weak: list[tuple[str, str, str]] = []

    if acc is None:
        weak.append(("本学期还没有练习作答记录", "了解学生未开始练习的原因，帮助其从基础章节入手。", "先从基础章节做几组练习"))
    elif acc < min_acc:
        weak.append((f"正确率 {acc}%，低于 {min_acc}% 的要求", "安排一次错题回顾，重点讲解反复出错的知识点。", "把错题整理出来，对照病例逐题复盘"))
    elif peer["accuracy"] is not None and acc >= peer["accuracy"] + 5:
        strengths.append(f"正确率 {acc}%，高于{d['peerLabel']} {peer['accuracy']}%")

    if hours < threshold:
        weak.append((f"学习时长 {hours} 小时，低于当前进度要求的 {threshold} 小时", "与学生约定每周固定的学习时间，并在一周后复查。", "每周固定安排 2～3 次、每次 30 分钟以上的平台学习"))
    elif peer["studyHours"] and hours >= peer["studyHours"] * 1.2:
        strengths.append(f"学习投入充足，学时 {hours} 小时，高于{d['peerLabel']} {peer['studyHours']} 小时")

    if idle is not None and idle >= 7:
        weak.append((f"已 {idle} 天没有学习记录", "尽快与学生沟通，了解近期是否有轮转或其他安排。", "尽快恢复学习节奏，哪怕每天 15 分钟也好"))

    if trend is not None and trend <= -10:
        weak.append((f"近两周正确率比之前下降约 {-trend} 个百分点", "关注近期新学章节的掌握情况，必要时放慢进度。", "回头巩固最近学习的章节，不要急于推进"))
    elif trend is not None and trend >= 10:
        strengths.append(f"近两周正确率比之前提升约 {trend} 个百分点，进步明显")

    weakest = min(practiced, key=lambda c: c["mastery"] - c["peerMastery"], default=None)
    if weakest and (weakest["mastery"] < 70 or weakest["mastery"] < weakest["peerMastery"] - 10):
        weak.append((
            f"「{weakest['chapter']}」掌握度 {weakest['mastery']}%（{d['peerLabel']} {weakest['peerMastery']}%）",
            f"针对「{weakest['chapter']}」布置专项练习，并推荐相关典型病例。",
            f"重点复习「{weakest['chapter']}」，多看相关典型病例",
        ))
    best = max(practiced, key=lambda c: c["mastery"], default=None)
    if best and best["mastery"] >= 85:
        strengths.append(f"「{best['chapter']}」掌握度 {best['mastery']}%，基础扎实")

    if missing and acc is not None:
        names = "、".join(f"「{c['chapter']}」" for c in missing[:3])
        more = f"等 {len(missing)} 个章节" if len(missing) > 3 else ""
        weak.append((f"尚未练习{names}{more}", "提醒学生补齐未练习的章节，避免知识面出现空白。", f"抽时间把「{missing[0]['chapter']}」等未练习的章节补上"))

    if rated >= 3 and agree["不一致"] / rated >= 0.4:
        weak.append((f"AI 判读对照中自评「不一致」占 {round(agree['不一致'] * 100 / rated)}%", "安排读片指导，帮助学生梳理影像征象的观察顺序。", "做 AI 判读时先写完整自己的判读，再逐条对照差异"))
    elif s["aiReads"] and peer["aiReads"] and s["aiReads"] >= peer["aiReads"] * 1.2:
        strengths.append(f"主动使用 AI 判读对照，共 {s['aiReads']} 次")

    if peer["caseViews"] and s["caseViews"] < peer["caseViews"] * 0.6:
        weak.append((f"病例浏览 {s['caseViews']} 次，少于{d['peerLabel']} {peer['caseViews']} 次", "引导学生做题后浏览相关病例，把做题和读片结合起来。", "做完练习后多看看相关病例，积累读片经验"))
    elif peer["caseViews"] and s["caseViews"] >= peer["caseViews"] * 1.2:
        strengths.append(f"病例浏览积极，共 {s['caseViews']} 次")

    if not weak:
        weak.append(("暂无明显短板", "可适当增加难度较高的综合题，进一步拔高。", "可以挑战一些综合性更强的题目"))

    if s["needsAttention"]:
        summary = f"该生目前处于「需关注」状态，主要问题是{weak[0][0]}。"
    elif len(strengths) >= 2:
        summary = f"该生整体表现良好，{strengths[0]}。"
    else:
        summary = f"该生整体状态平稳，需要留意：{weak[0][0]}。"

    praise = f"，{strengths[0]}，继续保持！" if strengths else "。"
    tips = "；".join(w[2] for w in weak[:2])
    message = (
        f"本学期你已学习 {hours} 小时、完成 {s['practiceCount']} 道练习{praise}"
        f"接下来建议你：{tips}。有不懂的地方随时和老师交流，加油！"
    )
    suggestions = [w[1] for w in weak] + ["两周后再查看一次该生的学情变化，确认改进效果。"]
    return {
        "summary": summary,
        "strengths": strengths[:3],
        "weaknesses": [w[0] for w in weak][:4],
        "suggestions": suggestions[:4],
        "message": message,
    }

