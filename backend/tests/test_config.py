import pytest

from app.config import ProdConfig

STRONG = "a" * 64


def _set(monkeypatch, **values):
    for name in ("DATABASE_URL", *ProdConfig.SECRETS):
        monkeypatch.setenv(name, values.get(name, STRONG))


def test_prod_config_accepts_strong_secrets(monkeypatch):
    _set(monkeypatch)
    ProdConfig.validate()


@pytest.mark.parametrize(
    "name, value",
    [
        ("JWT_SECRET_KEY", ""),
        ("MEDIA_SIGNING_KEY", "dev-only-media-signing-key"),
        ("MODEL_KEY_SECRET", "too-short"),
        ("DATABASE_URL", ""),
    ],
)
def test_prod_config_rejects_missing_or_default_secrets(monkeypatch, name, value):
    _set(monkeypatch, **{name: value})
    with pytest.raises(RuntimeError, match=name):
        ProdConfig.validate()
