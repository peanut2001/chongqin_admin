"""AI 判读模型：配置（app_settings.ai_model，API Key 加密保存）、获取模型列表、调用模型判读图像，
以及纯文本调用（complete_text，供学情分析使用）。

支持两种接口格式，均使用官方 SDK，可自定义服务地址（兼容中转 / 私有部署）：
- anthropic：Messages API（/v1/messages、/v1/models），服务地址填到域名即可，不含 /v1；
- openai：Chat Completions API（/chat/completions、/models），服务地址一般以 /v1 结尾。

使用自定义服务地址时，若所选格式被服务拒绝（403/404/405，如中转分组不允许 /v1/messages），
判读会自动改用另一种格式重试，成功后保存该格式（见 _alternate / _switch_format）。

未启用模型时，AI 判读仍返回演示结果（见 ai_demo）。
"""

import base64
import hashlib
import io
import json
import re
import time
from typing import Literal

import anthropic
import openai
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app
from PIL import Image
from pydantic import BaseModel, ValidationError, field_validator

from app.errors import ApiError
from app.extensions import db
from app.models import AppSetting
from app.services import audit
from app.services.timeutil import iso, now_utc

SETTING_KEY = "ai_model"
PROVIDERS = ("anthropic", "openai")
Provider = Literal["anthropic", "openai"]

# 发送给模型前的图像限制：长边超过 1568 像素时模型侧也会缩小，提前缩小可减少上传量与费用
MAX_IMAGE_EDGE = 1568
MAX_IMAGE_BYTES = 3_500_000
MODEL_SAFE_TYPES = {"image/png", "image/jpeg", "image/webp"}

SYSTEM_PROMPT = """你是医学影像教学平台的 AI 辅助判读助手，面向医学研究生的影像判读训练，结果仅供教学参考，不用于临床诊断。

请阅读用户提供的一张医学影像，独立给出判读，只输出一个 JSON 对象，不要输出任何其他文字或 Markdown 代码块。格式如下：
{
  "findings": [
    {"label": "异常所见的简短描述（含部位）", "confidence": 0.82, "box": {"x": 30, "y": 25, "w": 20, "h": 18}}
  ],
  "impression": "综合提示意见，1～3 句",
  "suggestions": ["面向学生的学习建议", "..."]
}

要求：
- findings 最多 5 条，按把握程度从高到低排列；没有明确异常时 findings 为空数组，并在 impression 中说明。
- confidence 为 0～1 之间的小数，表示你对该所见的把握程度。
- box 为该所见在图像中的大致位置，单位是图像宽、高的百分比（0～100），x、y 为左上角；无法定位时省略 box。
- suggestions 2～4 条，例如应重点观察的征象、需要鉴别的疾病、建议补充的检查。
- 全部使用简体中文。"""


# ===== 配置存取 =====


def _fernet() -> Fernet:
    secret = current_app.config["MODEL_KEY_SECRET"].encode()
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret).digest()))


def encrypt_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode()).decode()


def decrypt_key(cfg: dict) -> str:
    try:
        return _fernet().decrypt(cfg["apiKeyEnc"].encode()).decode()
    except (InvalidToken, KeyError, ValueError) as exc:
        raise ApiError(
            409, "api_key_unreadable", "已保存的 API Key 无法读取（加密密钥可能已更换），请管理员在设置中重新填写。"
        ) from exc


def load_config() -> dict | None:
    setting = db.session.get(AppSetting, SETTING_KEY)
    return dict(setting.value) if setting and isinstance(setting.value, dict) else None


def save_config(value: dict) -> None:
    setting = db.session.get(AppSetting, SETTING_KEY)
    if setting is None:
        db.session.add(AppSetting(key=SETTING_KEY, value=value))
    else:
        setting.value = value


def active_config() -> dict | None:
    """已启用且配置完整时返回配置，否则返回 None（判读使用演示结果）。"""
    cfg = load_config()
    if cfg and cfg.get("enabled") and cfg.get("model") and cfg.get("apiKeyEnc"):
        return cfg
    return None


def public_config(cfg: dict | None) -> dict:
    """返回给前端的配置：绝不包含 API Key，只给出末 4 位提示。"""
    cfg = cfg or {}
    last4 = cfg.get("apiKeyLast4")
    return {
        "provider": cfg.get("provider", "anthropic"),
        "baseUrl": cfg.get("baseUrl", ""),
        "model": cfg.get("model", ""),
        "enabled": bool(cfg.get("enabled")),
        "hasApiKey": bool(cfg.get("apiKeyEnc")),
        "apiKeyHint": f"••••{last4}" if last4 else None,
        "updatedAt": cfg.get("updatedAt"),
    }


def normalize_base_url(provider: str, url: str) -> str:
    url = url.strip().rstrip("/")
    # Anthropic SDK 会自行拼接 /v1/...，用户常把 /v1 一并填上
    if provider == "anthropic" and url.endswith("/v1"):
        url = url[:-3]
    return url


# ===== SDK 客户端与错误转换 =====


def _client(provider: str, base_url: str, api_key: str, timeout: float):
    kwargs = {
        "api_key": api_key,
        "timeout": timeout,
        "max_retries": current_app.config["AI_MODEL_MAX_RETRIES"],
    }
    if base_url:
        kwargs["base_url"] = base_url
    if provider == "anthropic":
        return anthropic.Anthropic(**kwargs)
    return openai.OpenAI(**kwargs)


def _model_error(message: str) -> ApiError:
    # 一律用 502：上游的 401 不能原样返回，否则前端会误以为登录失效
    return ApiError(502, "ai_model_error", message)


def _message(exc: Exception) -> str:
    for sdk in (anthropic, openai):
        if isinstance(exc, sdk.AuthenticationError):
            return "模型服务拒绝了 API Key（无效或已过期），请检查设置。"
        if isinstance(exc, sdk.PermissionDeniedError):
            return "当前 API Key 无权访问该模型或接口。"
        if isinstance(exc, sdk.NotFoundError):
            return "接口地址或模型不存在，请检查服务地址与模型名称。"
        if isinstance(exc, sdk.RateLimitError):
            return "模型服务请求过于频繁或额度不足，请稍后再试。"
        if isinstance(exc, sdk.BadRequestError):
            return "模型服务拒绝了本次请求。"
        if isinstance(exc, sdk.APIStatusError):
            return f"模型服务返回错误（HTTP {exc.status_code}），请稍后再试。"
        # APITimeoutError 是 APIConnectionError 的子类，需先判断
        if isinstance(exc, sdk.APITimeoutError):
            return "模型响应超时，请稍后再试。"
        if isinstance(exc, sdk.APIConnectionError):
            return "无法连接到模型服务，请检查服务地址与网络。"
    return "调用模型失败，请稍后再试。"


def _upstream_detail(exc: Exception) -> str | None:
    """上游返回的原始错误（HTTP 状态 + 错误信息），用于排查配置问题。"""
    if not isinstance(exc, (anthropic.APIStatusError, openai.APIStatusError)):
        return None
    text = str(getattr(exc, "message", "") or exc).strip()
    if len(text) > 300:
        text = text[:300] + "…"
    return f"HTTP {exc.status_code}：{text}"


def _translate(exc: Exception, show_detail: bool = False) -> ApiError:
    """转换为面向用户的错误。上游原文只给管理员看：其中可能含实际模型名等内部信息。"""
    detail = _upstream_detail(exc)
    current_app.logger.warning("调用模型失败：%s %s", type(exc).__name__, detail or "")
    message = _message(exc)
    if show_detail and detail:
        message = f"{message}服务返回：{detail}"
    return _model_error(message)


_SDK_ERRORS = (anthropic.APIError, openai.APIError)


# ===== 获取模型列表 =====


def list_models(provider: str, base_url: str, api_key: str) -> list[dict]:
    client = _client(provider, base_url, api_key, timeout=20)
    models: list[dict] = []
    try:
        if provider == "anthropic":
            for m in client.models.list(limit=100):  # 自动翻页
                models.append({"id": m.id, "name": m.display_name or m.id})
                if len(models) >= 1000:
                    break
        else:
            for m in client.models.list():
                models.append({"id": m.id, "name": m.id})
                if len(models) >= 1000:
                    break
            models.sort(key=lambda m: m["id"])
    except _SDK_ERRORS as exc:
        # 获取模型列表只有管理员能调用，附带上游原文
        raise _translate(exc, show_detail=True) from exc
    return models


# ===== 判读 =====


def prepare_image(data: bytes, content_type: str) -> tuple[bytes, str]:
    """缩小过大的图像，GIF 取首帧；其余格式原样发送。"""
    with Image.open(io.BytesIO(data)) as im:
        too_big = max(im.size) > MAX_IMAGE_EDGE or len(data) > MAX_IMAGE_BYTES
        if content_type in MODEL_SAFE_TYPES and not too_big:
            return data, content_type
        im.seek(0)
        frame = im.convert("RGB")
    frame.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
    out = io.BytesIO()
    frame.save(out, "JPEG", quality=90)
    return out.getvalue(), "image/jpeg"


class _Box(BaseModel):
    x: float
    y: float
    w: float
    h: float


class _Finding(BaseModel):
    label: str
    confidence: float = 0.5
    box: _Box | None = None

    @field_validator("label")
    @classmethod
    def _label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("empty label")
        return v[:200]


class _Result(BaseModel):
    findings: list[_Finding] = []
    impression: str = ""
    suggestions: list[str] = []


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def extract_json(text: str, what: str = "判读结果") -> dict:
    """从模型输出中取出 JSON 对象（容忍 Markdown 代码块和前后多余文字）。"""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise _model_error(f"模型没有按要求返回{what}，请重试或更换模型。")
    try:
        data = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise _model_error(f"模型返回的{what}格式不正确，请重试或更换模型。") from exc
    if not isinstance(data, dict):
        raise _model_error(f"模型返回的{what}格式不正确，请重试或更换模型。")
    return data


def parse_result(text: str) -> dict:
    """从模型输出中解析判读 JSON，并把数值限制在合法范围内。"""
    try:
        raw = _Result.model_validate(extract_json(text))
    except ValidationError as exc:
        raise _model_error("模型返回的判读结果格式不正确，请重试或更换模型。") from exc

    findings = []
    for f in raw.findings[:5]:
        conf = f.confidence / 100 if 1 < f.confidence <= 100 else f.confidence
        item: dict = {"label": f.label, "confidence": round(_clamp(conf, 0, 1), 2)}
        if f.box is not None:
            x, y = _clamp(f.box.x, 0, 100), _clamp(f.box.y, 0, 100)
            w, h = _clamp(f.box.w, 0, 100 - x), _clamp(f.box.h, 0, 100 - y)
            if w > 0 and h > 0:
                item["box"] = {"x": round(x, 1), "y": round(y, 1), "w": round(w, 1), "h": round(h, 1)}
        findings.append(item)

    impression = raw.impression.strip() or ("未见明确异常。" if not findings else "请结合所见综合判断。")
    suggestions = [s.strip()[:200] for s in raw.suggestions if s and s.strip()][:6]
    return {"findings": findings, "impression": impression[:1000], "suggestions": suggestions}


def _call_anthropic(client, model: str, image: bytes, media_type: str, prompt: str) -> str:
    resp = client.messages.create(
        model=model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.standard_b64encode(image).decode(),
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    if resp.stop_reason == "refusal":
        raise _model_error("模型拒绝了本次判读请求，请更换图像或模型。")
    return "".join(b.text for b in resp.content if b.type == "text")


def _call_openai(client, model: str, image: bytes, media_type: str, prompt: str) -> str:
    data_url = f"data:{media_type};base64,{base64.standard_b64encode(image).decode()}"
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )
    if not resp.choices:
        raise _model_error("模型没有返回内容，请重试。")
    msg = resp.choices[0].message
    if getattr(msg, "refusal", None):
        raise _model_error("模型拒绝了本次判读请求，请更换图像或模型。")
    return msg.content or ""


# 这些状态码通常表示「该接口 / 格式不可用」，值得换另一种格式重试；401（Key 无效）、429、5xx 换格式无济于事
_FORMAT_REJECTED = {403, 404, 405}


def _status(exc: Exception) -> int | None:
    return getattr(exc, "status_code", None)


def _alternate(provider: str, base_url: str) -> tuple[str, str] | None:
    """另一种接口格式及对应的服务地址。官方地址（未填写）不切换：官方 Key 不能跨家使用。"""
    if not base_url:
        return None
    if provider == "anthropic":
        return "openai", base_url.rstrip("/") + "/v1"
    return "anthropic", normalize_base_url("anthropic", base_url)


def _switch_format(cfg: dict, provider: str, base_url: str) -> None:
    """保存自动切换后的接口格式（随判读记录一起提交），并记入审计日志。"""
    current = load_config()
    # 配置在判读期间被管理员改过则不覆盖
    if not current or current.get("model") != cfg.get("model") or current.get("provider") != cfg.get("provider"):
        return
    current_app.logger.info("AI 模型接口格式自动切换：%s → %s", current.get("provider"), provider)
    audit.log(
        "settings.ai_model_format_switched",
        target_type="setting",
        target_id=SETTING_KEY,
        detail={
            "from": {"provider": current.get("provider"), "baseUrl": current.get("baseUrl")},
            "to": {"provider": provider, "baseUrl": base_url},
        },
    )
    save_config({**current, "provider": provider, "baseUrl": base_url, "updatedAt": iso(now_utc())})


def _invoke(cfg: dict, show_detail: bool, call) -> str:
    """按配置调用模型，call(provider, client) 返回模型输出的文本。

    中转服务常只开放一种接口格式（如分组不允许 /v1/messages）：被拒时换另一种格式重试一次，
    成功则保存可用的格式，之后直接使用。
    """
    provider = cfg.get("provider")
    if provider not in PROVIDERS:
        raise _model_error("AI 模型配置无效，请管理员检查设置。")
    api_key = decrypt_key(cfg)
    base_url = cfg.get("baseUrl", "")

    def run(prov: str, base: str) -> str:
        return call(prov, _client(prov, base, api_key, current_app.config["AI_MODEL_TIMEOUT"]))

    try:
        return run(provider, base_url)
    except _SDK_ERRORS as exc:
        alt = _alternate(provider, base_url) if _status(exc) in _FORMAT_REJECTED else None
        if alt is None:
            raise _translate(exc, show_detail) from exc
        try:
            text = run(*alt)
        except _SDK_ERRORS:
            raise _translate(exc, show_detail) from exc
        _switch_format(cfg, *alt)
        return text


def analyze(cfg: dict, image: bytes, content_type: str, modality: str, show_detail: bool = False) -> dict:
    """调用已配置的模型判读图像，返回与演示结果相同结构的 dict。失败时抛出 ApiError(502)。

    show_detail：失败提示是否附带上游原文（仅管理员）。
    """
    if cfg.get("provider") not in PROVIDERS:
        raise _model_error("AI 模型配置无效，请管理员检查设置。")
    try:
        image, media_type = prepare_image(image, content_type)
    except Exception as exc:
        raise ApiError(422, "invalid_file", "图片无法识别，请更换图片。") from exc

    prompt = f"检查类型：{modality}。请判读这张影像，并严格按要求只输出 JSON。"

    def call(prov: str, client) -> str:
        fn = _call_anthropic if prov == "anthropic" else _call_openai
        return fn(client, cfg["model"], image, media_type, prompt)

    started = time.monotonic()
    text = _invoke(cfg, show_detail, call)
    result = parse_result(text)
    result["elapsedMs"] = int((time.monotonic() - started) * 1000)
    return result


# ===== 纯文本对话（学情分析等） =====


def _text_anthropic(client, model: str, system: str, prompt: str) -> str:
    resp = client.messages.create(
        model=model,
        max_tokens=8000,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    if resp.stop_reason == "refusal":
        raise _model_error("模型拒绝了本次请求，请稍后重试或更换模型。")
    return "".join(b.text for b in resp.content if b.type == "text")


def _text_openai(client, model: str, system: str, prompt: str) -> str:
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
    )
    if not resp.choices:
        raise _model_error("模型没有返回内容，请重试。")
    msg = resp.choices[0].message
    if getattr(msg, "refusal", None):
        raise _model_error("模型拒绝了本次请求，请稍后重试或更换模型。")
    return msg.content or ""


def complete_text(cfg: dict, system: str, prompt: str, show_detail: bool = False) -> str:
    """纯文本调用已配置的模型，返回模型输出文本。失败时抛出 ApiError(502)。"""

    def call(prov: str, client) -> str:
        fn = _text_anthropic if prov == "anthropic" else _text_openai
        return fn(client, cfg["model"], system, prompt)

    return _invoke(cfg, show_detail, call)
