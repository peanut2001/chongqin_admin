import base64
from pathlib import Path

import pytest

from app.cli.content import import_content

FORBIDDEN_KEYS = {"answer", "explanation", "caseId", "topicId", "caption", "code"}


@pytest.fixture
def content(app):
    with app.app_context():
        import_content(Path(app.config["CONTENT_DIR"]))


def _walk(value, path="$"):
    """递归遍历 JSON，产出 (路径, 键, 值)。"""
    if isinstance(value, dict):
        for k, v in value.items():
            yield path, k, v
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from _walk(v, f"{path}[{i}]")


def _start(client, h, set_id):
    resp = client.post("/api/practice-sessions", json={"setId": set_id}, headers=h)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


@pytest.mark.parametrize("set_id", ["case-diagnosis", "us-case-diagnosis"])
def test_session_payload_does_not_leak_answers(client, make_user, auth_headers, content, set_id):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    session = _start(client, h, set_id)
    assert len(session["questions"]) == 10  # 病例题每次随机 10 道
    for path, key, value in _walk(session):
        assert key not in FORBIDDEN_KEYS, f"{path}.{key} 泄露了答案相关信息"
        if isinstance(value, str):
            assert "BL-" not in value, f"{path}.{key} 含有病例编号：{value}"

    # 题目配图地址与病例库中同一张图的地址不同，无法据此反查病例
    cases = client.get("/api/cases", headers=h).get_json()
    case_urls = {img["url"] for c in cases for img in c["images"]}
    q_urls = [img["url"] for q in session["questions"] for img in q["images"]]
    assert q_urls and not (set(q_urls) & case_urls)
    assert client.get(q_urls[0]).status_code == 200

    # token 本身也不能解码出图片 id（itsdangerous 签名串的载荷是明文 base64，曾因此泄露）
    case_image_ids = {u.rsplit("/", 1)[-1] for u in case_urls}
    for u in q_urls:
        token = u.rsplit("/", 1)[-1]
        decoded = base64.urlsafe_b64decode(token.split(".")[0] + "==").decode("latin-1")
        for image_id in case_image_ids:
            assert image_id not in token and image_id not in decoded and image_id.replace("-", "") not in token

    # 篡改过的 token 一律 404
    bad = q_urls[0][:-1] + ("0" if q_urls[0][-1] != "0" else "1")
    assert client.get(bad).status_code == 404
    assert client.get("/api/media/question-images/not-a-token").status_code == 404


def test_grading_and_reveal_after_submit(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    session = _start(client, h, "chest")  # 章节题：单选 + 多选 + 判断
    by_type = {q["type"]: q for q in session["questions"]}
    assert set(by_type) == {"单选题", "多选题", "判断题"}
    url = f"/api/practice-sessions/{session['id']}/answers"

    single = by_type["单选题"]
    resp = client.post(url, json={"questionId": single["id"], "selected": ["C"]}, headers=h).get_json()
    assert resp["correct"] is True and resp["answer"] == ["C"] and resp["explanation"]

    multi = by_type["多选题"]
    resp = client.post(url, json={"questionId": multi["id"], "selected": ["A", "B"]}, headers=h).get_json()
    assert resp["correct"] is False and resp["answer"] == ["A", "B", "C"]

    judge = by_type["判断题"]
    resp = client.post(url, json={"questionId": judge["id"], "selected": ["F"]}, headers=h).get_json()
    assert resp["correct"] is True

    # 重复提交返回原结果，不能改答案
    again = client.post(url, json={"questionId": multi["id"], "selected": ["A", "B", "C"]}, headers=h).get_json()
    assert again["correct"] is False and again["selected"] == ["A", "B"]


def test_invalid_answers_are_rejected(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    session = _start(client, h, "chest")
    q = next(q for q in session["questions"] if q["type"] == "单选题")
    url = f"/api/practice-sessions/{session['id']}/answers"
    assert client.post(url, json={"questionId": q["id"], "selected": ["Z"]}, headers=h).status_code == 422
    assert client.post(url, json={"questionId": q["id"], "selected": ["A", "B"]}, headers=h).status_code == 422


def test_cannot_touch_someone_elses_session(client, make_user, auth_headers, content):
    make_user("a@test.com")
    make_user("b@test.com")
    session = _start(client, auth_headers("a@test.com"), "chest")
    other = auth_headers("b@test.com")
    q = session["questions"][0]
    resp = client.post(
        f"/api/practice-sessions/{session['id']}/answers", json={"questionId": q["id"], "selected": ["A"]}, headers=other
    )
    assert resp.status_code == 404


def test_finish_counts_unanswered_as_wrong_and_lists_records(client, make_user, auth_headers, content):
    make_user("s@test.com")
    make_user("other@test.com")
    h = auth_headers("s@test.com")
    session = _start(client, h, "chest")
    q = next(q for q in session["questions"] if q["type"] == "单选题")
    client.post(f"/api/practice-sessions/{session['id']}/answers", json={"questionId": q["id"], "selected": ["C"]}, headers=h)
    result = client.post(f"/api/practice-sessions/{session['id']}/finish", headers=h).get_json()
    assert result["questionCount"] == 3 and result["correctCount"] == 1 and result["score"] == 33
    # 交卷后不能再答题
    closed = client.post(
        f"/api/practice-sessions/{session['id']}/answers", json={"questionId": q["id"], "selected": ["C"]}, headers=h
    )
    assert closed.status_code == 409

    _start(client, auth_headers("other@test.com"), "chest")  # 别人的未完成练习
    records = client.get("/api/practice-sessions", headers=h).get_json()
    assert records["total"] == 1 and records["items"][0]["correct"] == 1

    sets = {s["id"]: s for s in client.get("/api/question-sets", headers=h).get_json()}
    assert sets["case-diagnosis"]["total"] == 67
    assert sets["us-case-diagnosis"]["total"] == 207
    assert sets["chest"]["my"] == {"answered": 1, "accuracy": 100.0}
    assert sets["chest"]["avgAccuracy"] is None  # 作答太少不展示正确率
