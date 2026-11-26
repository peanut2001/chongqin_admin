"""生产单镜像：Flask 提供前端页面；可信反向代理下的客户端 IP。"""

import gzip

import pytest
from sqlalchemy import select

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import AuditLog

JS = "console.log('hello');" * 100


@pytest.fixture
def dist(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(
        "<html><head><title>t</title></head><body></body></html>", encoding="utf-8"
    )
    (tmp_path / "assets" / "app-abc123.js").write_text(JS)
    (tmp_path / "assets" / "app-abc123.js.gz").write_bytes(gzip.compress(JS.encode()))
    (tmp_path / "favicon.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    return tmp_path


@pytest.fixture
def web_client(app, dist, monkeypatch):
    monkeypatch.setattr(TestConfig, "WEB_DIST_DIR", str(dist))
    return create_app("test").test_client()


def test_spa_routes_return_index_with_demo_meta(web_client):
    for path in ("/", "/classes", "/learning-stats?classId=1"):
        resp = web_client.get(path)
        assert resp.status_code == 200 and resp.mimetype == "text/html"
        assert resp.headers["Cache-Control"] == "no-cache"
        assert '<meta name="demo-accounts"' in resp.get_data(as_text=True)


def test_no_demo_meta_when_demo_login_disabled(app, dist, monkeypatch):
    monkeypatch.setattr(TestConfig, "WEB_DIST_DIR", str(dist))
    monkeypatch.setattr(TestConfig, "ALLOW_DEMO_LOGIN", False)
    body = create_app("test").test_client().get("/").get_data(as_text=True)
    assert "demo-accounts" not in body


def test_assets_cached_and_precompressed(web_client):
    resp = web_client.get("/assets/app-abc123.js", headers={"Accept-Encoding": "gzip, br"})
    assert resp.status_code == 200 and resp.mimetype == "text/javascript"
    assert resp.headers["Content-Encoding"] == "gzip"
    assert "immutable" in resp.headers["Cache-Control"]
    assert gzip.decompress(resp.data) == JS.encode()

    plain = web_client.get("/assets/app-abc123.js")
    assert "Content-Encoding" not in plain.headers and plain.data == JS.encode()

    # 旧版本的打包文件不回退成入口页
    assert web_client.get("/assets/old-xyz.js").status_code == 404

    favicon = web_client.get("/favicon.png")
    assert favicon.status_code == 200 and favicon.mimetype == "image/png"


def test_api_paths_are_not_swallowed(web_client):
    missing = web_client.get("/api/not-exist")
    assert missing.status_code == 404 and missing.is_json
    assert web_client.get("/api/health").is_json


def test_path_traversal_returns_index(web_client):
    resp = web_client.get("/..%2fapp%2fconfig.py")
    assert resp.mimetype == "text/html" and b"SECRET" not in resp.data


def _last_login_ip(client, **kwargs) -> str:
    client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "wrong-pass"}, **kwargs)
    return str(db.session.scalar(select(AuditLog.ip).order_by(AuditLog.id.desc()).limit(1)))


def test_forwarded_for_ignored_without_trusted_proxy(app, client):
    with app.app_context():
        ip = _last_login_ip(
            client, headers={"X-Forwarded-For": "6.6.6.6"}, environ_base={"REMOTE_ADDR": "10.0.0.5"}
        )
    assert ip == "10.0.0.5"


def test_trusted_proxy_uses_address_it_appended(app, monkeypatch):
    monkeypatch.setattr(TestConfig, "TRUSTED_PROXIES", 1)
    proxied = create_app("test")
    with app.app_context():
        # 客户端伪造的 6.6.6.6 在前，反向代理追加的真实地址在最后
        ip = _last_login_ip(
            proxied.test_client(),
            headers={"X-Forwarded-For": "6.6.6.6, 203.0.113.7"},
            environ_base={"REMOTE_ADDR": "127.0.0.1"},
        )
    assert ip == "203.0.113.7"
