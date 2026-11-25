"""配置：全部从环境变量读取，开发环境的默认值由 docker-compose.dev.yml 提供。"""

import os
import tempfile
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        raise RuntimeError(f"缺少环境变量 {name}")
    return value


class Config:
    SQLALCHEMY_DATABASE_URI = _env(
        "DATABASE_URL", "postgresql+psycopg://chongqin:chongqin@localhost:5432/chongqin"
    )
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        # 数据库会话统一使用 UTC，所有时间列为 timestamptz
        "connect_args": {"options": "-c timezone=UTC"},
    }

    JWT_SECRET_KEY = _env("JWT_SECRET_KEY", "dev-only-jwt-secret-please-change-in-production-0123456789")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    # access token 走 Authorization 头（前端仅存内存）；refresh token 走 httpOnly cookie
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_REFRESH_COOKIE_NAME = "refresh_token"
    JWT_REFRESH_COOKIE_PATH = "/api/auth"
    JWT_COOKIE_SAMESITE = "Strict"
    JWT_COOKIE_SECURE = _env("JWT_COOKIE_SECURE", "false").lower() == "true"
    # 前后端同源（Vite / nginx 代理 /api），refresh cookie 为 SameSite=Strict，跨站请求不会携带；
    # /refresh 只在 JSON 响应体里返回 token，跨源页面读不到，因此不额外启用 CSRF 双提交。
    # 若将来改为跨域部署，必须改为 SameSite=None + Secure 并开启 JWT_COOKIE_CSRF_PROTECT。
    JWT_COOKIE_CSRF_PROTECT = False

    MEDIA_SIGNING_KEY = _env("MEDIA_SIGNING_KEY", "dev-only-media-signing-key")
    SIGNED_URL_MAX_AGE = 3600

    UPLOAD_DIR = Path(_env("UPLOAD_DIR", str(BASE_DIR / "uploads")))
    CONTENT_DIR = Path(_env("CONTENT_DIR", str(BASE_DIR / "content")))
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    AVATAR_MAX_BYTES = 1 * 1024 * 1024
    AI_IMAGE_MAX_BYTES = 8 * 1024 * 1024

    APP_TZ = _env("APP_TZ", "Asia/Shanghai")

    # 登录限流：同一邮箱或 IP 在窗口期内失败次数上限
    LOGIN_FAIL_LIMIT = 10
    LOGIN_FAIL_WINDOW_MINUTES = 15

    # 学情「需关注」阈值：正确率低于 ATTENTION_ACCURACY，或平台学习时长低于
    # ATTENTION_HOURS_FULL_SEMESTER × 当前周 / ATTENTION_HOURS_REFERENCE_WEEKS（第 12 周时为 5 小时，约每周 25 分钟）
    # 这是教学管理策略，可按课程要求调整
    ATTENTION_ACCURACY = 65
    ATTENTION_HOURS_FULL_SEMESTER = 5
    ATTENTION_HOURS_REFERENCE_WEEKS = 12

    JSON_SORT_KEYS = False


class DevConfig(Config):
    DEBUG = True


class TestConfig(Config):
    TESTING = True
    # 测试上传写到临时目录，不污染开发环境的上传卷
    UPLOAD_DIR = Path(tempfile.gettempdir()) / "chongqin-test-uploads"
    SQLALCHEMY_DATABASE_URI = _env(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://chongqin:chongqin@localhost:5432/chongqin_test",
    )
    LOGIN_FAIL_LIMIT = 5


class ProdConfig(Config):
    JWT_COOKIE_SECURE = True


CONFIGS = {"dev": DevConfig, "test": TestConfig, "prod": ProdConfig}
