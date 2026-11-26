import os

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import CONFIGS
from app.errors import register_error_handlers
from app.extensions import db, jwt, migrate


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)
    config = CONFIGS[config_name or os.environ.get("APP_CONFIG", "dev")]
    # 生产环境缺少密钥或仍使用开发默认值时直接启动失败，而不是悄悄用公开的默认值
    config.validate()
    app.config.from_object(config)
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)
    jwt.init_app(app)

    # 注册模型，让 Alembic 能发现全部表
    from app import models  # noqa: F401
    from app.auth import jwt_callbacks  # noqa: F401  注册 JWT 回调

    from app.api import register_blueprints

    register_blueprints(app)
    register_error_handlers(app)

    from app.cli import register_cli

    register_cli(app)

    # 生产单镜像：同一进程提供前端页面（必须在接口蓝图之后注册，未匹配的 /api 路径仍返回 JSON 404）
    from app.web import init_web

    init_web(app)

    proxies = app.config["TRUSTED_PROXIES"]
    if proxies > 0:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxies, x_proto=proxies)
    return app
