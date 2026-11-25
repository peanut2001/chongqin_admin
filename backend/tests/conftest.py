"""pytest：使用真实 PostgreSQL 测试库（jsonb、部分索引、时区等行为必须与生产一致）。

整个测试会话执行一次迁移（顺带验证迁移本身），每个测试结束后清空所有表。
运行：docker compose -f docker-compose.dev.yml exec api pytest
"""

import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy import text

from app import create_app
from app.extensions import db
from app.models import User
from app.services.passwords import hash_password

PASSWORD = "secret123"


@pytest.fixture(scope="session")
def app():
    app = create_app("test")
    with app.app_context():
        # 从零开始迁移，确保迁移脚本本身可用
        downgrade(revision="base")
        upgrade()
    yield app


@pytest.fixture(autouse=True)
def _clean_db(app):
    yield
    with app.app_context():
        db.session.remove()
        tables = ", ".join(
            f'"{t.name}"' for t in reversed(db.metadata.sorted_tables)
        )
        db.session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_user(app):
    def _make(email="user@test.com", role="student", status="active", **kw):
        with app.app_context():
            user = User(
                email=email,
                username=kw.pop("username", email.split("@")[0]),
                first_name=kw.pop("first_name", "Test"),
                last_name=kw.pop("last_name", "User"),
                role=role,
                status=status,
                password_hash=hash_password(kw.pop("password", PASSWORD)),
                **kw,
            )
            db.session.add(user)
            db.session.commit()
            return str(user.id)

    return _make


def login(client, email, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


@pytest.fixture
def auth_headers(client):
    """登录并返回 Authorization 头。"""

    def _headers(email, password=PASSWORD):
        resp = login(client, email, password)
        assert resp.status_code == 200, resp.get_json()
        return {"Authorization": f"Bearer {resp.get_json()['accessToken']}"}

    return _headers
