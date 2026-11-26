"""AI 模型配置与模型判读。真实模型调用全部打桩，不访问外网。"""

import io
from pathlib import Path

import pytest
from PIL import Image

from app.cli.content import import_content
from app.errors import ApiError
from app.extensions import db
from app.models import AiReading, AppSetting, Upload
from app.services import ai_model


@pytest.fixture
def content(app):
    with app.app_context():
        import_content(Path(app.config["CONTENT_DIR"]))


def _png(size=(8, 8)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "white").save(buf, "PNG")
    return buf.getvalue()


def _enable(client, h, **kw):
    body = {"provider": "openai", "baseUrl": "https://example.com/v1", "apiKey": "sk-test-123456",
            "model": "vision-1", "enabled": True, **kw}
    return client.put("/api/settings/ai-model", json=body, headers=h)


def test_settings_admin_only(client, make_user, auth_headers):
    make_user("t@test.com", role="teacher")
    h = auth_headers("t@test.com")
    assert client.get("/api/settings/ai-model", headers=h).status_code == 403
    assert _enable(client, h).status_code == 403


def test_api_key_encrypted_and_never_returned(app, client, make_user, auth_headers):
    make_user("a@test.com", role="admin")
    h = auth_headers("a@test.com")

    data = client.get("/api/settings/ai-model", headers=h).get_json()
    assert data["enabled"] is False and data["hasApiKey"] is False

    resp = _enable(client, h)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data["apiKeyHint"] == "••••3456" and "sk-test" not in str(data)

    with app.app_context():
        stored = db.session.get(AppSetting, "ai_model").value
        assert "sk-test-123456" not in str(stored)
        assert ai_model.decrypt_key(stored) == "sk-test-123456"

    # Key 留空保存：沿用原 Key
    resp = _enable(client, h, apiKey="", model="vision-2")
    assert resp.get_json()["apiKeyHint"] == "••••3456"
    with app.app_context():
        assert ai_model.decrypt_key(db.session.get(AppSetting, "ai_model").value) == "sk-test-123456"


def test_enable_requires_key_and_model(client, make_user, auth_headers):
    make_user("a@test.com", role="admin")
    h = auth_headers("a@test.com")
    resp = _enable(client, h, apiKey="", model="")
    assert resp.status_code == 422
    assert set(resp.get_json()["fields"]) == {"apiKey", "model"}
    assert _enable(client, h, baseUrl="ftp://x").status_code == 422


def test_anthropic_base_url_strips_v1(client, make_user, auth_headers):
    make_user("a@test.com", role="admin")
    h = auth_headers("a@test.com")
    resp = _enable(client, h, provider="anthropic", baseUrl="https://proxy.example.com/v1/")
    assert resp.get_json()["baseUrl"] == "https://proxy.example.com"


def test_list_models_uses_saved_key(client, make_user, auth_headers, monkeypatch):
    make_user("a@test.com", role="admin")
    h = auth_headers("a@test.com")
    calls = []
    monkeypatch.setattr(
        ai_model, "list_models",
        lambda provider, base_url, key: calls.append((provider, base_url, key)) or [{"id": "m1", "name": "M1"}],
    )
    # 未保存 Key 且未填写
    resp = client.post("/api/settings/ai-model/models", json={"provider": "openai"}, headers=h)
    assert resp.status_code == 422

    _enable(client, h)
    resp = client.post("/api/settings/ai-model/models", json={"provider": "openai", "baseUrl": "https://example.com/v1"}, headers=h)
    assert resp.get_json() == {"models": [{"id": "m1", "name": "M1"}]}
    assert calls[-1] == ("openai", "https://example.com/v1", "sk-test-123456")


def test_upstream_auth_error_is_502_not_401(app):
    import httpx2
    import openai

    req = httpx2.Request("GET", "https://example.com/v1/models")
    exc = openai.AuthenticationError("bad key", response=httpx2.Response(401, request=req), body=None)
    with app.app_context():
        err = ai_model._translate(exc)
    assert err.status == 502


def test_upstream_detail_only_for_admin(app):
    import httpx2
    import anthropic

    req = httpx2.Request("POST", "https://relay.example.com/v1/messages")
    body = {"type": "error", "error": {"type": "permission_error", "message": "model gpt-x not allowed in this group"}}
    exc = anthropic.PermissionDeniedError("model gpt-x not allowed in this group", response=httpx2.Response(403, request=req), body=body)
    with app.app_context():
        student = ai_model._translate(exc).title
        admin = ai_model._translate(exc, show_detail=True).title
    assert "gpt-x" not in student
    assert "HTTP 403" in admin and "not allowed in this group" in admin


def _permission_denied():
    import anthropic
    import httpx2

    req = httpx2.Request("POST", "https://relay.example.com/v1/messages")
    return anthropic.PermissionDeniedError(
        "This group does not allow /v1/messages dispatch", response=httpx2.Response(403, request=req), body=None
    )


RESULT_JSON = '{"findings":[],"impression":"未见明确异常。","suggestions":["复查"]}'


def test_rejected_format_falls_back_and_is_saved(app, client, make_user, auth_headers, monkeypatch):
    make_user("a@test.com", role="admin")
    _enable(client, auth_headers("a@test.com"), provider="anthropic", baseUrl="https://relay.example.com")
    calls = []

    def fake_anthropic(client_, model, image, media_type, prompt):
        calls.append(("anthropic", str(client_.base_url)))
        raise _permission_denied()

    def fake_openai(client_, model, image, media_type, prompt):
        calls.append(("openai", str(client_.base_url)))
        return RESULT_JSON

    monkeypatch.setattr(ai_model, "_call_anthropic", fake_anthropic)
    monkeypatch.setattr(ai_model, "_call_openai", fake_openai)

    with app.app_context():
        result = ai_model.analyze(ai_model.active_config(), _png(), "image/png", "胸部 CT")
        db.session.commit()
        assert result["impression"] == "未见明确异常。"
        saved = ai_model.load_config()
        assert saved["provider"] == "openai" and saved["baseUrl"] == "https://relay.example.com/v1"
        assert ai_model.decrypt_key(saved) == "sk-test-123456"  # Key 不受影响

        # 下次直接使用切换后的格式
        calls.clear()
        ai_model.analyze(ai_model.active_config(), _png(), "image/png", "胸部 CT")
        assert [c[0] for c in calls] == ["openai"]


def test_no_fallback_for_official_endpoint_or_bad_key(app, client, make_user, auth_headers, monkeypatch):
    import anthropic
    import httpx2

    make_user("a@test.com", role="admin")
    h = auth_headers("a@test.com")
    called_openai = []
    monkeypatch.setattr(ai_model, "_call_openai", lambda *a: called_openai.append(1) or RESULT_JSON)

    # 官方地址（未填写服务地址）：不切换
    _enable(client, h, provider="anthropic", baseUrl="")
    monkeypatch.setattr(ai_model, "_call_anthropic", lambda *a: (_ for _ in ()).throw(_permission_denied()))
    with app.app_context(), pytest.raises(ApiError):
        ai_model.analyze(ai_model.active_config(), _png(), "image/png", "胸部 CT")

    # Key 无效（401）：换格式无济于事，不切换
    _enable(client, h, provider="anthropic", baseUrl="https://relay.example.com")
    req = httpx2.Request("POST", "https://relay.example.com/v1/messages")
    bad_key = anthropic.AuthenticationError("invalid key", response=httpx2.Response(401, request=req), body=None)
    monkeypatch.setattr(ai_model, "_call_anthropic", lambda *a: (_ for _ in ()).throw(bad_key))
    with app.app_context(), pytest.raises(ApiError):
        ai_model.analyze(ai_model.active_config(), _png(), "image/png", "胸部 CT")
    assert called_openai == []


def test_parse_result_clamps_values():
    text = '```json\n{"findings":[{"label":"右肺结节","confidence":87,"box":{"x":90,"y":-5,"w":30,"h":20}},' \
           '{"label":"无框","confidence":0.4}],"impression":"考虑结节","suggestions":["复查"]}\n```'
    r = ai_model.parse_result(text)
    assert r["findings"][0]["confidence"] == 0.87
    assert r["findings"][0]["box"] == {"x": 90, "y": 0, "w": 10, "h": 20}
    assert "box" not in r["findings"][1]
    with pytest.raises(ApiError):
        ai_model.parse_result("抱歉，我无法判读")


def test_prepare_image_downscales_large_images():
    data, media_type = ai_model.prepare_image(_png((3000, 2000)), "image/png")
    assert media_type == "image/jpeg"
    with Image.open(io.BytesIO(data)) as im:
        assert max(im.size) == ai_model.MAX_IMAGE_EDGE
    small = _png()
    assert ai_model.prepare_image(small, "image/png") == (small, "image/png")


def test_reading_uses_model_when_enabled(app, client, make_user, auth_headers, content, monkeypatch):
    make_user("a@test.com", role="admin")
    make_user("s@test.com")
    _enable(client, auth_headers("a@test.com"))
    h = auth_headers("s@test.com")

    seen = {}

    def fake_analyze(cfg, image, content_type, modality, show_detail=False):
        seen.update(model=cfg["model"], size=len(image), type=content_type)
        return {"findings": [], "impression": "未见明确异常。", "suggestions": [], "elapsedMs": 12}

    monkeypatch.setattr(ai_model, "analyze", fake_analyze)

    display = "DolphonUltrasound72BV1.9"
    meta = client.get("/api/ai/samples", headers=h).get_json()
    assert meta["engine"] == {"mode": "model", "model": display}
    sample = meta["samples"][0]
    resp = client.post("/api/ai/readings", data={"sampleId": sample["id"], "modality": sample["modality"], "opinion": "考虑肺癌"}, headers=h)
    assert resp.status_code == 201, resp.get_json()
    reading = resp.get_json()
    assert reading["isDemo"] is False and reading["disclaimer"] is None
    assert reading["resultSource"] == "model" and reading["modelName"] == display
    # 实际调用的模型名不出现在学生可见的接口中，只保存在数据库
    listing = client.get("/api/ai/readings", headers=h).get_json()
    assert "vision-1" not in str(meta) + str(reading) + str(listing)
    with app.app_context():
        assert db.session.query(AiReading).one().model_version == "vision-1"
    assert seen["model"] == "vision-1" and seen["size"] > 0


def test_model_failure_saves_nothing(app, client, make_user, auth_headers, content, monkeypatch):
    make_user("a@test.com", role="admin")
    make_user("s@test.com")
    _enable(client, auth_headers("a@test.com"))
    h = auth_headers("s@test.com")

    def boom(*a, **kw):
        raise ApiError(502, "ai_model_error", "模型响应超时，请稍后再试。")

    monkeypatch.setattr(ai_model, "analyze", boom)
    upload_dir = Path(app.config["UPLOAD_DIR"]) / "ai_image"
    before = set(upload_dir.iterdir()) if upload_dir.exists() else set()
    resp = client.post(
        "/api/ai/readings",
        data={"file": (io.BytesIO(_png()), "x.png"), "modality": "胸部 CT", "opinion": "未见明显异常"},
        headers=h,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 502
    assert resp.get_json()["title"] == "模型响应超时，请稍后再试。"
    with app.app_context():
        assert db.session.query(AiReading).count() == 0
        assert db.session.query(Upload).count() == 0
    after = set(upload_dir.iterdir()) if upload_dir.exists() else set()
    assert after == before


def test_disabled_model_falls_back_to_demo(client, make_user, auth_headers, content):
    make_user("a@test.com", role="admin")
    make_user("s@test.com")
    _enable(client, auth_headers("a@test.com"), enabled=False)
    meta = client.get("/api/ai/samples", headers=auth_headers("s@test.com")).get_json()
    assert meta["engine"]["mode"] == "demo"
