import json
import shutil
from pathlib import Path

import click
import pytest
from sqlalchemy import select

from app.cli.content import import_content
from app.extensions import db
from app.models import CaseImage


@pytest.fixture
def content(app):
    with app.app_context():
        return import_content(Path(app.config["CONTENT_DIR"]))


def test_import_is_idempotent_and_ids_are_stable(app, content):
    with app.app_context():
        first_ids = sorted(str(i) for i in db.session.scalars(select(CaseImage.id)))
        again = import_content(Path(app.config["CONTENT_DIR"]))
        second_ids = sorted(str(i) for i in db.session.scalars(select(CaseImage.id)))
    assert again == content
    assert first_ids == second_ids
    assert content["cases"] == 389 and content["questions"] == 287


def test_import_rejects_case_without_license(app, tmp_path):
    src = Path(app.config["CONTENT_DIR"])
    for name in ("disease_topics.json", "case_texts.json", "question_sets.json", "ai_samples.json"):
        shutil.copy(src / name, tmp_path / name)
    (tmp_path / "case-images").symlink_to(src / "case-images")
    library = json.loads((src / "case_library.json").read_text(encoding="utf-8"))
    library[0]["source"]["license"] = ""
    (tmp_path / "case_library.json").write_text(json.dumps(library), encoding="utf-8")
    with app.app_context(), pytest.raises(click.ClickException):
        import_content(tmp_path)


def test_case_list_and_detail(client, make_user, auth_headers, content):
    make_user("s@test.com")
    h = auth_headers("s@test.com")
    cases = client.get("/api/cases", headers=h).get_json()
    assert len(cases) == 389
    assert "fullText" not in cases[0]
    assert cases[0]["source"]["license"]
    image_url = cases[0]["images"][0]["url"]
    assert "BL-" not in image_url

    detail = client.get(f"/api/cases/{cases[0]['id']}", headers=h).get_json()
    assert len(detail["fullText"]) > 100

    img = client.get(image_url)  # 病例图片公开（开放获取内容，<img> 无法带令牌）
    assert img.status_code == 200
    assert "immutable" in img.headers["Cache-Control"]

    assert len(client.get("/api/topics", headers=h).get_json()) == 42
    assert client.get("/api/cases").status_code == 401


def test_case_views_are_deduplicated_and_capped(client, make_user, auth_headers, content):
    make_user("s@test.com")
    make_user("t@test.com", role="teacher")
    h = auth_headers("s@test.com")
    first = client.post("/api/cases/BL-0101/views", headers=h)
    second = client.post("/api/cases/BL-0101/views", headers=h)
    assert first.status_code == 201 and second.status_code == 200
    view_id = first.get_json()["id"]
    assert second.get_json()["id"] == view_id

    resp = client.patch(f"/api/case-views/{view_id}", json={"durationSeconds": 99999}, headers=h)
    assert resp.status_code == 422  # 超过一天直接拒绝
    resp = client.patch(f"/api/case-views/{view_id}", json={"durationSeconds": 7200}, headers=h)
    assert resp.get_json()["durationSeconds"] == 1800  # 单次浏览最多计 30 分钟
    # 别人的浏览记录不能改
    other = auth_headers("t@test.com")
    assert client.patch(f"/api/case-views/{view_id}", json={"durationSeconds": 5}, headers=other).status_code == 404
