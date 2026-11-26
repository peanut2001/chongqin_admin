"""学情详情与 AI 学情分析（群体 / 单人）。"""

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select

from app.cli.content import import_content
from app.cli.demo_history import seed_history
from app.cli.seed import seed_accounts
from app.extensions import db
from app.models import User
from app.services import ai_model


@pytest.fixture
def seeded(app):
    with app.app_context():
        import_content(Path(app.config["CONTENT_DIR"]))
        seed_accounts()
        seed_history(seed=7, now=datetime(2026, 11, 24, 12, 0, tzinfo=UTC))
        students = db.session.scalars(select(User).where(User.role == "student")).all()
        return [str(u.id) for u in students]


def _teacher(auth_headers):
    return auth_headers("teacher@demo.com", "demo1234")


def test_student_detail(client, auth_headers, seeded):
    h = _teacher(auth_headers)
    d = client.get(f"/api/stats/students/{seeded[0]}", headers=h).get_json()
    assert d["student"]["userId"] == seeded[0]
    assert d["peerLabel"] in ("班级平均", "全体平均")
    assert d["weeklyActivity"] and d["chapterMastery"]
    assert {"一致", "部分一致", "不一致", "未自评"} <= d["aiAgreement"].keys()
    assert all("peerMastery" in c for c in d["chapterMastery"])


def test_advice_only_for_staff_and_students(client, auth_headers, seeded):
    s = auth_headers("student@demo.com", "demo1234")
    assert client.get(f"/api/stats/students/{seeded[0]}", headers=s).status_code == 403
    assert client.post("/api/stats/ai-advice", json={"userIds": seeded}, headers=s).status_code == 403

    h = _teacher(auth_headers)
    assert client.get("/api/stats/students/not-a-uuid", headers=h).status_code == 404
    with client.application.app_context():
        teacher = db.session.scalar(select(User).where(User.role == "teacher"))
        tid = str(teacher.id)
    assert client.get(f"/api/stats/students/{tid}", headers=h).status_code == 404
    assert client.post("/api/stats/ai-advice", json={"userIds": []}, headers=h).status_code == 422
    assert client.post("/api/stats/ai-advice", json={"userIds": ["x"]}, headers=h).status_code == 422
    # 只给了非学生 → 范围内没有学生
    assert client.post("/api/stats/ai-advice", json={"userIds": [tid]}, headers=h).status_code == 422


def test_demo_advice_when_model_disabled(client, auth_headers, seeded):
    h = _teacher(auth_headers)
    g = client.post("/api/stats/ai-advice", json={"userIds": seeded}, headers=h).get_json()
    assert g["isDemo"] is True and g["disclaimer"]
    assert g["summary"] and g["issues"] and len(g["suggestions"]) >= 2
    assert all(f["userId"] in seeded and f["name"] for f in g["focusStudents"])

    for uid in seeded[:10]:
        r = client.post(f"/api/stats/students/{uid}/ai-advice", headers=h).get_json()
        assert r["isDemo"] is True
        assert r["summary"] and r["weaknesses"] and len(r["suggestions"]) >= 2 and r["message"]


def _enable_model(client, auth_headers, make_user):
    make_user("a@test.com", role="admin")
    a = auth_headers("a@test.com")
    body = {"provider": "openai", "baseUrl": "https://example.com/v1", "apiKey": "sk-test-123456",
            "model": "text-1", "enabled": True}
    assert client.put("/api/settings/ai-model", json=body, headers=a).status_code == 200


def test_group_advice_with_model_is_anonymous(client, auth_headers, make_user, seeded, monkeypatch):
    _enable_model(client, auth_headers, make_user)
    sent = {}

    def fake(client_, model, system, prompt):
        sent["prompt"] = prompt
        return "```json\n" + json.dumps({
            "summary": "整体不错",
            "issues": [{"title": "学时分化", "detail": "差距大"}],
            "focusStudents": [{"code": "学生2", "reason": "学时少"}, {"code": "学生999", "reason": "不存在"},
                              {"code": "2", "reason": "重复"}],
            "suggestions": ["专项练习", "", "先和学生2谈话"],
        }, ensure_ascii=False) + "\n```"

    monkeypatch.setattr(ai_model, "_text_openai", fake)
    h = _teacher(auth_headers)
    r = client.post("/api/stats/ai-advice", json={"userIds": seeded}, headers=h).get_json()
    assert r["isDemo"] is False and r["summary"] == "整体不错"
    assert len(r["focusStudents"]) == 1 and r["focusStudents"][0]["reason"] == "学时少"
    assert r["suggestions"][0] == "专项练习" and len(r["suggestions"]) == 2
    # 文字中的代号换回姓名
    assert r["suggestions"][1] == f"先和{r['focusStudents'][0]['name']}谈话"

    # 发给模型的数据不含姓名与学号
    with client.application.app_context():
        users = db.session.scalars(select(User).where(User.role == "student")).all()
        for u in users:
            assert u.display_name not in sent["prompt"]
            assert not u.student_no or u.student_no not in sent["prompt"]


def test_student_advice_with_model(client, auth_headers, make_user, seeded, monkeypatch):
    _enable_model(client, auth_headers, make_user)
    monkeypatch.setattr(ai_model, "_text_openai", lambda *a: json.dumps(
        {"summary": "稳定", "strengths": ["正确率高"], "weaknesses": ["学时少"],
         "suggestions": ["约定学习时间"], "message": "加油"}, ensure_ascii=False))
    h = _teacher(auth_headers)
    r = client.post(f"/api/stats/students/{seeded[0]}/ai-advice", headers=h).get_json()
    assert r["isDemo"] is False and r["message"] == "加油" and r["weaknesses"] == ["学时少"]

    monkeypatch.setattr(ai_model, "_text_openai", lambda *a: "抱歉，我无法分析")
    resp = client.post(f"/api/stats/students/{seeded[0]}/ai-advice", headers=h)
    assert resp.status_code == 502
