import uuid

from app.extensions import db
from app.models import User
from tests.conftest import login

NEW_USER = {
    "firstName": "明",
    "lastName": "李",
    "username": "liming",
    "email": "liming@test.com",
    "phoneNumber": "+86 1",
    "role": "student",
    "password": "abc12345",
}


def _admin(make_user, auth_headers, email="admin@test.com"):
    admin_id = make_user(email, role="admin")
    return admin_id, auth_headers(email)


def test_only_admin_can_manage_users(client, make_user, auth_headers):
    make_user("t@test.com", role="teacher")
    resp = client.get("/api/users", headers=auth_headers("t@test.com"))
    assert resp.status_code == 403


def test_list_filters_pagination_and_facets(client, make_user, auth_headers):
    _, h = _admin(make_user, auth_headers)
    for i in range(12):
        make_user(f"s{i}@test.com", role="student", status="active" if i % 3 else "suspended")
    make_user("teach@test.com", role="teacher")

    resp = client.get("/api/users?page=2&pageSize=5", headers=h)
    body = resp.get_json()
    assert body["total"] == 14 and len(body["items"]) == 5 and body["page"] == 2

    # 重复参数（status=a&status=b）
    resp = client.get("/api/users?status=suspended&status=inactive&role=student", headers=h)
    body = resp.get_json()
    assert body["total"] == 4
    assert {u["status"] for u in body["items"]} == {"suspended"}
    # 分面计数应用「其他」筛选条件：status 分面按 role=student 统计
    assert body["facets"]["status"] == {"active": 8, "suspended": 4}
    assert body["facets"]["role"] == {"student": 4}

    resp = client.get("/api/users?username=S1", headers=h)  # 不区分大小写的关键字
    assert {u["email"] for u in resp.get_json()["items"]} == {"s1@test.com", "s10@test.com", "s11@test.com"}


def test_create_user_and_conflicts(client, make_user, auth_headers):
    _, h = _admin(make_user, auth_headers)
    resp = client.post("/api/users", json=NEW_USER, headers=h)
    assert resp.status_code == 201
    created = resp.get_json()
    assert created["email"] == "liming@test.com" and created["status"] == "active"
    assert "password" not in created and "passwordHash" not in created
    # 新用户可以登录
    assert login(client, "liming@test.com", "abc12345").status_code == 200

    dup = client.post("/api/users", json={**NEW_USER, "username": "other", "email": "LIMING@test.com"}, headers=h)
    assert dup.status_code == 409
    assert "email" in dup.get_json()["fields"]


def test_create_user_validates_password(client, make_user, auth_headers):
    _, h = _admin(make_user, auth_headers)
    resp = client.post("/api/users", json={**NEW_USER, "password": "short"}, headers=h)
    assert resp.status_code == 422
    assert "password" in resp.get_json()["fields"]


def test_admin_cannot_disable_demote_or_delete_self(client, make_user, auth_headers):
    admin_id, h = _admin(make_user, auth_headers)
    make_user("admin2@test.com", role="admin")  # 另有管理员，排除「最后一个管理员」规则
    for payload in ({"status": "suspended"}, {"role": "teacher"}):
        resp = client.patch(f"/api/users/{admin_id}", json=payload, headers=h)
        assert resp.status_code == 409
        assert resp.get_json()["code"] == "self_protection"
    assert client.delete(f"/api/users/{admin_id}", headers=h).status_code == 409


def test_last_active_admin_is_protected(app, client, make_user, auth_headers):
    admin_id, h = _admin(make_user, auth_headers)
    other_id = make_user("admin2@test.com", role="admin")
    # 停用另一个管理员后，当前管理员成为最后一个
    assert client.patch(f"/api/users/{other_id}", json={"status": "suspended"}, headers=h).status_code == 200
    resp = client.post("/api/users/bulk", json={"action": "delete", "ids": [admin_id]}, headers=h)
    assert resp.get_json()["skipped"] == [{"id": admin_id, "reason": "self"}]


def test_status_change_revokes_sessions(app, client, make_user, auth_headers):
    _, h = _admin(make_user, auth_headers)
    sid = make_user("s@test.com")
    with app.test_client() as student:
        login(student, "s@test.com")
        assert student.post("/api/auth/refresh").status_code == 200
        client.patch(f"/api/users/{sid}", json={"status": "inactive"}, headers=h)
        resp = student.post("/api/auth/refresh")
        assert resp.status_code == 401


def test_password_reset_activates_invited_user(client, make_user, auth_headers):
    _, h = _admin(make_user, auth_headers)
    resp = client.post("/api/users/invite", json={"email": "new@test.com", "role": "teacher"}, headers=h)
    assert resp.status_code == 201
    invited = resp.get_json()
    assert invited["status"] == "invited"
    assert login(client, "new@test.com", "whatever1").status_code == 401  # 尚无密码

    resp = client.patch(f"/api/users/{invited['id']}", json={"password": "newpass99"}, headers=h)
    assert resp.get_json()["status"] == "active"
    assert login(client, "new@test.com", "newpass99").status_code == 200


def test_bulk_actions_skip_self_and_report(app, client, make_user, auth_headers):
    admin_id, h = _admin(make_user, auth_headers)
    s1, s2 = make_user("s1@test.com"), make_user("s2@test.com")
    missing = str(uuid.uuid4())
    resp = client.post(
        "/api/users/bulk", json={"action": "deactivate", "ids": [s1, s2, admin_id, missing]}, headers=h
    )
    body = resp.get_json()
    assert body["affected"] == 2
    assert {(x["id"], x["reason"]) for x in body["skipped"]} == {(admin_id, "self"), (missing, "not_found")}
    with app.app_context():
        assert db.session.get(User, uuid.UUID(s1)).status == "inactive"

    resp = client.post("/api/users/bulk", json={"action": "delete", "ids": [s1]}, headers=h)
    assert resp.get_json()["affected"] == 1
    with app.app_context():
        assert db.session.get(User, uuid.UUID(s1)) is None


def test_non_student_loses_student_fields(client, make_user, auth_headers):
    _, h = _admin(make_user, auth_headers)
    resp = client.post("/api/users", json={**NEW_USER, "studentNo": "S1"}, headers=h)
    uid = resp.get_json()["id"]
    resp = client.patch(f"/api/users/{uid}", json={"role": "teacher"}, headers=h)
    assert resp.status_code == 200
    assert resp.get_json()["studentNo"] is None
