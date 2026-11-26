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

    # 加密数据库中保存的 AI 模型 API Key；更换后已保存的 Key 无法解密，需在设置页重新填写
    MODEL_KEY_SECRET = _env("MODEL_KEY_SECRET", "dev-only-model-key-secret")
    # 调用 AI 模型的超时（秒）与重试次数；判读是同步请求，不宜过长
    # AI 判读对外显示的模型名称（判读页、判读记录统一显示此名称，不暴露实际调用的模型）
    AI_MODEL_DISPLAY_NAME = _env("AI_MODEL_DISPLAY_NAME", "DolphonUltrasound72BV1.9")
    AI_MODEL_TIMEOUT = 90
    AI_MODEL_MAX_RETRIES = 1

    UPLOAD_DIR = Path(_env("UPLOAD_DIR", str(BASE_DIR / "uploads")))
    CONTENT_DIR = Path(_env("CONTENT_DIR", str(BASE_DIR / "content")))
    # 前端打包产物目录：设置后由 Flask 直接提供前端页面（生产镜像），开发环境由 Vite 提供
    WEB_DIST_DIR = os.environ.get("WEB_DIST_DIR") or None

    # 前面有几层可信反向代理（宝塔 / nginx 等）。>0 时从 X-Forwarded-For 末尾取对应层数得到客户端 IP，
    # 客户端自己伪造的部分不会被采用；没有反向代理、直接对外时必须为 0
    TRUSTED_PROXIES = int(_env("TRUSTED_PROXIES", "0"))
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    AVATAR_MAX_BYTES = 1 * 1024 * 1024
    AI_IMAGE_MAX_BYTES = 8 * 1024 * 1024

    APP_TZ = _env("APP_TZ", "Asia/Shanghai")

    # 是否允许演示账号（flask seed 创建、is_demo=true，密码公开在源码中）登录。
    # 默认关闭：正式环境即使忘了清理演示数据，演示账号也无法登录；开发环境由 docker-compose 打开。
    ALLOW_DEMO_LOGIN = _env("ALLOW_DEMO_LOGIN", "false").lower() == "true"

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

    @classmethod
    def validate(cls) -> None:
        """启动时检查配置；开发 / 测试环境不检查。"""


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
    # 部分测试使用 flask seed 创建的演示账号
    ALLOW_DEMO_LOGIN = True


class ProdConfig(Config):
    # refresh cookie 只走 HTTPS；只有临时用 http://IP 访问时才设为 false
    JWT_COOKIE_SECURE = _env("JWT_COOKIE_SECURE", "true").lower() == "true"

    # 这些值有开发默认值（公开在源码中），正式环境必须显式设置为随机长字符串
    SECRETS = ("JWT_SECRET_KEY", "MEDIA_SIGNING_KEY", "MODEL_KEY_SECRET")

    @classmethod
    def validate(cls) -> None:
        problems = [] if os.environ.get("DATABASE_URL") else ["DATABASE_URL 未设置"]
        for name in cls.SECRETS:
            value = os.environ.get(name, "")
            if not value:
                problems.append(f"{name} 未设置")
            elif value.startswith("dev-only") or len(value) < 32:
                problems.append(f"{name} 不能使用开发默认值，且至少 32 个字符")
        if problems:
            raise RuntimeError("生产配置有误：" + "；".join(problems) + "。可用 openssl rand -hex 32 生成。")


CONFIGS = {"dev": DevConfig, "test": TestConfig, "prod": ProdConfig}
