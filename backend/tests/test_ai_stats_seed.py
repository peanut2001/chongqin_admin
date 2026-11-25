import io
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.cli.content import import_content
from app.cli.demo_history import clear_demo_activity, seed_history
from app.cli.seed import seed_accounts
from app.extensions import db
from app.models import CaseView, PracticeSession, Semester, User
from app.services import stats as svc


@pytest.fixture
def content(app):
    with app.app_context():
        import_content(Path(app.config["CONTENT_DIR"]))


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buf, "PNG")
    return buf.getvalue()


def test_ai_reading_with_sample_and_agreement(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    data = client.get("/api/ai/samples", headers=h).get_json()
    assert data["modalities"] and data["samples"]
    sample = data["samples"][0]

    missing = client.post("/api/ai/readings", data={"sampleId": sample["id"], "modality": "x", "opinion": ""}, headers=h)
    assert missing.status_code == 422  # 必须先写判读意见

    resp = client.post(
        "/api/ai/readings", data={"sampleId": sample["id"], "modality": sample["modality"], "opinion": "考虑肺癌"}, headers=h
    )
    assert resp.status_code == 201
    reading = resp.get_json()
    assert reading["isDemo"] is True and reading["disclaimer"]
    assert reading["result"]["findings"]

    resp = client.patch(f"/api/ai/readings/{reading['id']}", json={"agreement": "一致"}, headers=h)
    assert resp.get_json()["agreement"] == "一致"
    listing = client.get("/api/ai/readings", headers=h).get_json()
    assert listing["total"] == 1


def test_ai_upload_uses_expiring_signed_url(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    resp = client.post(
        "/api/ai/readings",
        data={"file": (io.BytesIO(_png()), "x.png"), "modality": "胸部 CT", "opinion": "未见明显异常"},
        headers=h,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201, resp.get_json()
    url = resp.get_json()["imageUrl"]
    assert client.get(url).status_code == 200
    assert client.get(url[:-3] + "abc").status_code == 403  # 篡改签名


def test_ai_reading_requires_exactly_one_image(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    resp = client.post("/api/ai/readings", data={"modality": "胸部 CT", "opinion": "看不出"}, headers=h)
    assert resp.status_code == 422


def test_week_bucketing_uses_local_timezone(app, make_user, content):
    with app.app_context():
        seed_accounts()  # 学期 2026-09-07 开始
        sem = db.session.scalar(select(Semester))
        student = db.session.scalar(select(User).where(User.student_no == "S2025001"))
        # UTC 9 月 13 日 16:30 = 北京时间 9 月 14 日 00:30，属于第 2 周
        db.session.add(CaseView(user_id=student.id, case_id="BL-0101", viewed_at=datetime(2026, 9, 13, 16, 30, tzinfo=UTC)))
        db.session.commit()
        weeks = svc.weekly_activity(sem, 3, svc.Scope(user_id=student.id))
    assert [w["caseViews"] for w in weeks] == [0, 1, 0]
    assert all(w["accuracy"] is None for w in weeks)  # 没有作答时正确率为空，而不是 0


def test_students_cannot_read_class_stats(client, make_user, auth_headers, app, content):
    with app.app_context():
        seed_accounts()
    h = auth_headers("student@demo.com", "demo1234")
    assert client.get("/api/stats/overview", headers=h).status_code == 403
    assert client.get("/api/dashboard", headers=h).get_json()["scope"] == "personal"
    t = auth_headers("teacher@demo.com", "demo1234")
    assert client.get("/api/dashboard", headers=t).get_json()["scope"] == "class"


def test_seed_history_is_reproducible_and_clear_keeps_real_data(app, content):
    now = datetime(2026, 11, 24, 12, 0, tzinfo=UTC)
    with app.app_context():
        seed_accounts()
        first = seed_history(seed=7, now=now)
        second = seed_history(seed=7, now=now)
        assert first == second and first["attempts"] > 0
        # 没有未来的记录
        latest = db.session.scalar(select(func.max(PracticeSession.finished_at)))
        assert latest <= now

        real_user = db.session.scalar(select(User).where(User.student_no == "S2025001"))
        db.session.add(CaseView(user_id=real_user.id, case_id="BL-0101", is_demo=False))
        db.session.commit()

        clear_demo_activity()
        assert db.session.scalar(select(func.count()).select_from(PracticeSession)) == 0
        remaining = db.session.scalars(select(CaseView)).all()
        assert len(remaining) == 1 and remaining[0].is_demo is False


def test_bad_uuid_paths_return_404(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    assert client.get("/api/media/case-images/not-a-uuid").status_code == 404
    assert client.get(f"/api/media/case-images/{uuid.uuid4()}").status_code == 404
    assert client.post("/api/practice-sessions/xyz/finish", headers=h).status_code == 404
