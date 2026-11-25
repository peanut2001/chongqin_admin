import pytest
from flask_jwt_extended import decode_token

from app.extensions import db
from app.models import User
from tests.conftest import login


def test_login_success_returns_user_and_refresh_cookie(client, make_user):
    make_user("a@test.com", role="teacher")
    resp = login(client, "A@Test.com")  # 邮箱不区分大小写
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["user"]["email"] == "a@test.com"
    assert body["user"]["role"] == "teacher"
    assert body["accessToken"]
    cookie = resp.headers.get("Set-Cookie", "")
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/auth" in cookie


def test_wrong_password_and_unknown_email_are_indistinguishable(client, make_user):
    make_user("a@test.com")
    wrong = login(client, "a@test.com", "bad-password")
    unknown = login(client, "nobody@test.com", "bad-password")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.get_json() == unknown.get_json()


@pytest.mark.parametrize(
    "status,title",
    [
        ("inactive", "该账号未激活，请联系管理员。"),
        ("invited", "该账号尚未接受邀请，请联系管理员。"),
        ("suspended", "该账号已被停用，请联系管理员。"),
    ],
)
def test_non_active_accounts_cannot_login(client, make_user, status, title):
    make_user("a@test.com", status=status)
    resp = login(client, "a@test.com")
    assert resp.status_code == 403
    assert resp.get_json()["title"] == title


def test_access_token_sub_is_string(app, client, make_user):
    make_user("a@test.com")
    token = login(client, "a@test.com").get_json()["accessToken"]
    with app.app_context():
        assert isinstance(decode_token(token)["sub"], str)


def test_disabled_user_loses_access_on_next_request(app, client, make_user):
    user_id = make_user("a@test.com")
    login(client, "a@test.com")
    assert client.post("/api/auth/refresh").status_code == 200
    with app.app_context():
        db.session.get(User, __import__("uuid").UUID(user_id)).status = "suspended"
        db.session.commit()
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "account_disabled"


def test_token_version_bump_revokes_existing_tokens(app, client, make_user):
    user_id = make_user("a@test.com")
    login(client, "a@test.com")
    with app.app_context():
        db.session.get(User, __import__("uuid").UUID(user_id)).token_version += 1
        db.session.commit()
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "token_revoked"


def test_logout_revokes_refresh_token(client, make_user):
    make_user("a@test.com")
    login(client, "a@test.com")
    cookie = client.get_cookie("refresh_token", path="/api/auth")
    assert cookie is not None
    stolen = cookie.value
    assert client.post("/api/auth/logout").status_code == 200
    # 即使有人保存了旧的 refresh token，退出后也不能再用
    client.set_cookie("refresh_token", stolen, path="/api/auth")
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401
    assert resp.get_json()["code"] == "token_revoked"


def test_login_is_throttled_after_repeated_failures(app, client, make_user):
    make_user("a@test.com")
    limit = app.config["LOGIN_FAIL_LIMIT"]
    for _ in range(limit):
        assert login(client, "a@test.com", "bad").status_code == 401
    resp = login(client, "a@test.com")  # 即使密码正确也先被限流
    assert resp.status_code == 429


def test_refresh_without_cookie_is_unauthorized(client):
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_demo_accounts_blocked_when_demo_login_disabled(app, client, make_user, auth_headers):
    """正式环境（ALLOW_DEMO_LOGIN 关闭）：演示账号密码公开在源码里，必须无法登录。"""
    make_user("demo@test.com", is_demo=True)
    make_user("real@test.com")
    demo_headers = auth_headers("demo@test.com")  # 测试配置默认允许，先拿到一个已登录的会话

    app.config["ALLOW_DEMO_LOGIN"] = False
    try:
        resp = login(client, "demo@test.com")
        assert resp.status_code == 403 and resp.get_json()["code"] == "demo_disabled"
        # 密码错误时仍是普通的 401，不暴露账号是否为演示账号
        assert login(client, "demo@test.com", "wrong-pass1").get_json()["code"] == "invalid_credentials"

        # 已登录的演示账号立即失效：普通接口与刷新都被拒绝
        me_resp = client.get("/api/me", headers=demo_headers)
        assert me_resp.status_code == 401 and me_resp.get_json()["code"] == "demo_disabled"
        assert client.post("/api/auth/refresh").status_code == 401

        # 真实账号不受影响
        assert login(client, "real@test.com").status_code == 200
    finally:
        app.config["ALLOW_DEMO_LOGIN"] = True
