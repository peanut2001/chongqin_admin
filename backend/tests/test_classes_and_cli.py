from sqlalchemy import select

from app.extensions import db
from app.models import AuditLog, SchoolClass, User
from tests.conftest import login


def _admin_headers(make_user, auth_headers):
    make_user("admin@test.com", role="admin")
    return auth_headers("admin@test.com")


# ---------- 班级管理 ----------


def test_only_admin_can_manage_classes(client, make_user, auth_headers):
    make_user("t@test.com", role="teacher")
    make_user("s@test.com")
    for email in ("t@test.com", "s@test.com"):
        h = auth_headers(email)
        assert client.get("/api/classes", headers=h).status_code == 403
        assert client.post("/api/classes", json={"name": "x"}, headers=h).status_code == 403


def test_class_crud_and_meta(client, make_user, auth_headers):
    h = _admin_headers(make_user, auth_headers)

    resp = client.post("/api/classes", json={"name": "  2026 级影像硕士 1 班 ", "cohortYear": 2026}, headers=h)
    assert resp.status_code == 201, resp.get_json()
    created = resp.get_json()
    assert created["name"] == "2026 级影像硕士 1 班"  # 首尾空格已去除
    assert created["cohortYear"] == 2026 and created["studentCount"] == 0

    # 重名 → 409 字段错误
    dup = client.post("/api/classes", json={"name": "2026 级影像硕士 1 班"}, headers=h)
    assert dup.status_code == 409 and "name" in dup.get_json()["fields"]

    # 入学年份范围、空名称 → 422
    assert client.post("/api/classes", json={"name": "a", "cohortYear": 1990}, headers=h).status_code == 422
    assert client.post("/api/classes", json={"name": "   "}, headers=h).status_code == 422

    other = client.post("/api/classes", json={"name": "2026 级影像硕士 2 班"}, headers=h).get_json()
    # 改成已存在的名称 → 409；改成新名称 → 200
    clash = client.patch(f"/api/classes/{other['id']}", json={"name": "2026 级影像硕士 1 班"}, headers=h)
    assert clash.status_code == 409
    renamed = client.patch(
        f"/api/classes/{other['id']}", json={"name": "2026 级影像博士班", "cohortYear": None}, headers=h
    )
    assert renamed.status_code == 200 and renamed.get_json()["name"] == "2026 级影像博士班"
    assert renamed.get_json()["cohortYear"] is None

    listed = client.get("/api/classes", headers=h).get_json()
    assert [c["name"] for c in listed] == ["2026 级影像博士班", "2026 级影像硕士 1 班"]
    # 所有角色共用的 /meta 也能看到
    meta_names = {c["name"] for c in client.get("/api/meta", headers=h).get_json()["classes"]}
    assert meta_names == {"2026 级影像博士班", "2026 级影像硕士 1 班"}

    assert client.patch("/api/classes/99999", json={"name": "x"}, headers=h).status_code == 404
    assert client.delete("/api/classes/99999", headers=h).status_code == 404


def test_cannot_delete_class_with_students(app, client, make_user, auth_headers):
    h = _admin_headers(make_user, auth_headers)
    cls = client.post("/api/classes", json={"name": "1 班"}, headers=h).get_json()
    make_user("s@test.com", student_no="S1", class_id=cls["id"])

    assert client.get("/api/classes", headers=h).get_json()[0]["studentCount"] == 1
    resp = client.delete(f"/api/classes/{cls['id']}", headers=h)
    assert resp.status_code == 409
    body = resp.get_json()
    assert body["code"] == "class_not_empty" and body["studentCount"] == 1

    # 学生移出班级后可以删除
    with app.app_context():
        user = db.session.scalar(select(User).where(User.email == "s@test.com"))
        user.class_id = None
        db.session.commit()
    assert client.delete(f"/api/classes/{cls['id']}", headers=h).status_code == 204
    with app.app_context():
        assert db.session.get(SchoolClass, cls["id"]) is None
        actions = set(db.session.scalars(select(AuditLog.action)))
        assert {"class.create", "class.delete"} <= actions


# ---------- flask users create-admin ----------


def _create_admin(app, *args: str):
    return app.test_cli_runner().invoke(args=["users", "create-admin", *args])


def test_create_admin_command(app, client):
    result = _create_admin(
        app, "--email", "Root@School.edu.cn", "--last-name", "王", "--first-name", "老师", "--password", "abc12345"
    )
    assert result.exit_code == 0, result.output
    assert "已创建管理员：王老师" in result.output

    with app.app_context():
        user = db.session.scalar(select(User).where(User.username == "Root"))
        assert user.role == "admin" and user.status == "active" and not user.is_demo
        assert user.password_hash != "abc12345"
    assert login(client, "root@school.edu.cn", "abc12345").status_code == 200


def test_create_admin_interactive_prompts(app):
    # 不带参数时逐项询问，密码需输入两次
    result = app.test_cli_runner().invoke(
        args=["users", "create-admin"], input="a@test.com\n李\n明\nabc12345\nabc12345\n"
    )
    assert result.exit_code == 0, result.output
    with app.app_context():
        assert db.session.scalar(select(User.role).where(User.email == "a@test.com")) == "admin"


def test_create_admin_rejects_bad_input(app, make_user):
    base = ["--last-name", "王", "--first-name", "五"]
    weak = _create_admin(app, "--email", "a@test.com", *base, "--password", "short1")
    assert weak.exit_code != 0 and "至少为 8 个字符" in weak.output

    bad_email = _create_admin(app, "--email", "not-an-email", *base, "--password", "abc12345")
    assert bad_email.exit_code != 0 and "邮箱格式不正确" in bad_email.output

    make_user("taken@test.com", username="taken")
    dup_email = _create_admin(app, "--email", "TAKEN@test.com", *base, "--username", "x", "--password", "abc12345")
    assert dup_email.exit_code != 0 and "邮箱已被其他用户使用" in dup_email.output

    dup_name = _create_admin(app, "--email", "taken@other.com", *base, "--password", "abc12345")
    assert dup_name.exit_code != 0 and "--username" in dup_name.output

    with app.app_context():
        assert db.session.scalar(select(User).where(User.role == "admin")) is None
