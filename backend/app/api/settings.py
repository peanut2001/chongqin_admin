"""系统设置（仅管理员）：AI 判读模型配置。"""

import re
from typing import Literal

from flask import Blueprint
from pydantic import Field, field_validator

from app.auth.decorators import auth_required, me
from app.errors import ApiError
from app.extensions import db
from app.schemas import CamelModel, parse_body
from app.services import ai_model, audit
from app.services.timeutil import iso, now_utc

bp = Blueprint("settings", __name__)

_URL = re.compile(r"^https?://[^\s/]+\S*$")


class _ConnectionFields(CamelModel):
    provider: Literal["anthropic", "openai"]
    base_url: str = Field(default="", max_length=300)
    # 留空表示沿用已保存的 Key
    api_key: str = Field(default="", max_length=500)

    @field_validator("base_url")
    @classmethod
    def _check_url(cls, v: str) -> str:
        if v and not _URL.match(v):
            raise ValueError("请填写以 http:// 或 https:// 开头的地址")
        return v


class AiModelBody(_ConnectionFields):
    model: str = Field(default="", max_length=200)
    enabled: bool = False


@bp.get("/settings/ai-model")
@auth_required("admin")
def get_ai_model():
    return ai_model.public_config(ai_model.load_config())


@bp.put("/settings/ai-model")
@auth_required("admin")
def update_ai_model():
    body = parse_body(AiModelBody)
    cfg = ai_model.load_config() or {}

    if body.api_key:
        key_enc, last4 = ai_model.encrypt_key(body.api_key), body.api_key[-4:]
    else:
        key_enc, last4 = cfg.get("apiKeyEnc"), cfg.get("apiKeyLast4")

    if body.enabled:
        fields = {}
        if not key_enc:
            fields["apiKey"] = "启用前请填写 API Key"
        if not body.model:
            fields["model"] = "启用前请选择或填写模型"
        if fields:
            raise ApiError(422, "validation_error", "配置不完整，无法启用。", fields)

    value = {
        "provider": body.provider,
        "baseUrl": ai_model.normalize_base_url(body.provider, body.base_url),
        "model": body.model,
        "enabled": body.enabled,
        "apiKeyEnc": key_enc,
        "apiKeyLast4": last4,
        "updatedAt": iso(now_utc()),
    }
    ai_model.save_config(value)
    audit.log(
        "settings.ai_model_updated",
        actor_id=me().id,
        target_type="setting",
        target_id=ai_model.SETTING_KEY,
        # 不记录 Key 本身
        detail={
            "provider": value["provider"],
            "baseUrl": value["baseUrl"],
            "model": value["model"],
            "enabled": value["enabled"],
            "apiKeyChanged": bool(body.api_key),
        },
    )
    db.session.commit()
    return ai_model.public_config(value)


@bp.post("/settings/ai-model/models")
@auth_required("admin")
def list_ai_models():
    """用表单中的连接信息（Key 留空则用已保存的 Key）获取可用模型，同时可作为连通性测试。"""
    body = parse_body(_ConnectionFields)
    api_key = body.api_key
    if not api_key:
        cfg = ai_model.load_config()
        if not cfg or not cfg.get("apiKeyEnc"):
            raise ApiError(422, "validation_error", "请先填写 API Key。", {"apiKey": "请填写 API Key"})
        api_key = ai_model.decrypt_key(cfg)
    base_url = ai_model.normalize_base_url(body.provider, body.base_url)
    return {"models": ai_model.list_models(body.provider, base_url, api_key)}
