import os

from flask import Flask

from app.config import CONFIGS
from app.errors import register_error_handlers
from app.extensions import db, jwt, migrate


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(CONFIGS[config_name or os.environ.get("APP_CONFIG", "dev")])
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
    return app
