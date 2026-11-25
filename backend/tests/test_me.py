import io
from pathlib import Path

from PIL import Image

from tests.conftest import login


def _png_bytes(size=(4, 4)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "red").save(buf, "PNG")
    return buf.getvalue()


ANIMATED_SVG = (
    b'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
    b'<circle r="3"><animate attributeName="r" values="1;4;1" dur="1s" repeatCount="indefinite"/>'
    b"</circle><script>alert(1)</script></svg>"
)


def _upload(client, headers, data: bytes, name: str):
    return client.put(
        "/api/me/avatar",
        data={"file": (io.BytesIO(data), name)},
        headers=headers,
        content_type="multipart/form-data",
    )


def test_get_and_update_profile(client, make_user, auth_headers):
    make_user("s@test.com", first_name="明", last_name="李")
    h = auth_headers("s@test.com")
    me = client.get("/api/me", headers=h).get_json()
    assert me["authUser"]["name"] == "李明"

    resp = client.patch("/api/me", json={"firstName": "华", "phoneNumber": "123"}, headers=h)
    body = resp.get_json()
    assert body["firstName"] == "华" and body["phoneNumber"] == "123"
    assert body["authUser"]["name"] == "李华"
    # 不能借个人资料接口修改角色等字段
    resp = client.patch("/api/me", json={"role": "admin"}, headers=h)
    assert resp.status_code == 422


def test_change_password_keeps_current_session_and_revokes_others(app, client, make_user, auth_headers):
    make_user("s@test.com")
    with app.test_client() as other_device:
        login(other_device, "s@test.com")
        h = auth_headers("s@test.com")

        wrong = client.post(
            "/api/me/password", json={"currentPassword": "nope", "newPassword": "newpass99"}, headers=h
        )
        assert wrong.status_code == 422 and "currentPassword" in wrong.get_json()["fields"]

        resp = client.post(
            "/api/me/password",
            json={"currentPassword": "secret123", "newPassword": "newpass99"},
            headers=h,
        )
        assert resp.status_code == 200
        new_headers = {"Authorization": f"Bearer {resp.get_json()['accessToken']}"}
        assert client.get("/api/me", headers=new_headers).status_code == 200
        # 当前会话的旧 token 与其他设备都失效
        assert client.get("/api/me", headers=h).status_code == 401
        assert other_device.post("/api/auth/refresh").status_code == 401
    assert login(client, "s@test.com", "newpass99").status_code == 200


def test_upload_png_avatar_and_serve_publicly(app, client, make_user, auth_headers):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    resp = _upload(client, h, _png_bytes(), "a.png")
    assert resp.status_code == 200
    url = resp.get_json()["avatarUrl"]
    assert url.startswith("/api/media/avatars/")

    img = client.get(url)  # 无需登录即可访问（<img> 带不了 Authorization 头）
    assert img.status_code == 200
    assert img.mimetype == "image/png"
    assert img.headers["X-Content-Type-Options"] == "nosniff"
    assert "sandbox" in img.headers["Content-Security-Policy"]


def test_svg_avatar_is_served_as_attachment_with_sandbox(client, make_user, auth_headers):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    url = _upload(client, h, ANIMATED_SVG, "x.svg").get_json()["avatarUrl"]
    resp = client.get(url)
    assert resp.mimetype == "image/svg+xml"
    assert resp.headers["Content-Disposition"].startswith("attachment")
    assert "sandbox" in resp.headers["Content-Security-Policy"]


def test_type_is_sniffed_from_content_not_extension(client, make_user, auth_headers):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    # HTML 改名为 .png：拒绝
    resp = _upload(client, h, b"<html><script>alert(1)</script></html>", "evil.png")
    assert resp.status_code == 422
    # PNG 改名为 .svg：按真实内容识别为 PNG
    url = _upload(client, h, _png_bytes(), "fake.svg").get_json()["avatarUrl"]
    assert client.get(url).mimetype == "image/png"


def test_avatar_size_limit(app, client, make_user, auth_headers):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    big = b"\x89PNG\r\n\x1a\n" + b"0" * (app.config["AVATAR_MAX_BYTES"] + 10)
    resp = _upload(client, h, big, "big.png")
    assert resp.status_code == 413
    assert resp.get_json()["code"] == "file_too_large"


def test_replacing_avatar_deletes_old_file(app, client, make_user, auth_headers):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    first = _upload(client, h, _png_bytes(), "a.png").get_json()["avatarUrl"]
    second = _upload(client, h, _png_bytes((8, 8)), "b.png").get_json()["avatarUrl"]
    assert first != second
    assert client.get(first).status_code == 404
    old_file = Path(app.config["UPLOAD_DIR"]) / "avatar" / first.rsplit("/", 1)[1]
    assert not old_file.exists()

    resp = client.delete("/api/me/avatar", headers=h)
    assert resp.get_json()["avatarUrl"] is None
    assert client.get(second).status_code == 404
