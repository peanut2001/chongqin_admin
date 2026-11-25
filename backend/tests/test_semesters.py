AUTUMN = {
    "name": "2026-2027 学年第一学期",
    "course": "医学影像诊断学（研究生）",
    "startDate": "2026-09-07",
    "endDate": "2027-01-10",
}
SPRING = {
    "name": "2026-2027 学年第二学期",
    "course": "医学影像诊断学（研究生）",
    "startDate": "2027-02-22",
    "endDate": "2027-07-04",
    "totalWeeks": 18,
}


def _admin(make_user, auth_headers):
    make_user("admin@test.com", role="admin")
    return auth_headers("admin@test.com")


def test_only_admin_can_manage_semesters(client, make_user, auth_headers):
    make_user("t@test.com", role="teacher")
    h = auth_headers("t@test.com")
    assert client.get("/api/semesters", headers=h).status_code == 403
    assert client.post("/api/semesters", json=AUTUMN, headers=h).status_code == 403


def test_first_semester_becomes_current_and_unblocks_dashboard(client, make_user, auth_headers):
    h = _admin(make_user, auth_headers)
    # 全新部署：没有学期时仪表盘不可用
    assert client.get("/api/dashboard", headers=h).get_json()["code"] == "no_semester"

    resp = client.post("/api/semesters", json=AUTUMN, headers=h)
    assert resp.status_code == 201, resp.get_json()
    sem = resp.get_json()
    assert sem["isCurrent"] is True
    assert sem["totalWeeks"] == 18  # 按起止日期自动计算

    assert client.get("/api/meta", headers=h).get_json()["semester"]["id"] == sem["id"]
    assert client.get("/api/dashboard", headers=h).status_code == 200


def test_validation(client, make_user, auth_headers):
    h = _admin(make_user, auth_headers)
    reversed_dates = client.post("/api/semesters", json={**AUTUMN, "endDate": "2026-09-01"}, headers=h)
    assert reversed_dates.status_code == 422 and "endDate" in reversed_dates.get_json()["fields"]

    too_many = client.post("/api/semesters", json={**AUTUMN, "totalWeeks": 20}, headers=h)
    assert too_many.status_code == 422 and "totalWeeks" in too_many.get_json()["fields"]

    too_long = client.post("/api/semesters", json={**AUTUMN, "endDate": "2027-06-30"}, headers=h)
    assert too_long.status_code == 422  # 超过 30 周

    assert client.post("/api/semesters", json={**AUTUMN, "name": " "}, headers=h).status_code == 422
    assert client.get("/api/semesters", headers=h).get_json() == []


def test_switch_current_edit_and_delete(client, make_user, auth_headers):
    h = _admin(make_user, auth_headers)
    autumn = client.post("/api/semesters", json=AUTUMN, headers=h).get_json()
    spring = client.post("/api/semesters", json=SPRING, headers=h).get_json()
    assert spring["isCurrent"] is False  # 已有当前学期，不自动切换

    listed = client.get("/api/semesters", headers=h).get_json()
    assert [s["id"] for s in listed] == [spring["id"], autumn["id"]]  # 最新的在前

    # 当前学期不能删除
    assert client.delete(f"/api/semesters/{autumn['id']}", headers=h).status_code == 409

    # 切换当前学期：只有一个当前学期
    assert client.post(f"/api/semesters/{spring['id']}/activate", headers=h).get_json()["isCurrent"] is True
    current = [s["id"] for s in client.get("/api/semesters", headers=h).get_json() if s["isCurrent"]]
    assert current == [spring["id"]]
    assert client.get("/api/meta", headers=h).get_json()["semester"]["id"] == spring["id"]

    # 只改名称：周数不变；改日期不给周数：重新计算
    renamed = client.patch(f"/api/semesters/{autumn['id']}", json={"name": "秋季学期"}, headers=h).get_json()
    assert renamed["name"] == "秋季学期" and renamed["totalWeeks"] == 18
    shorter = client.patch(f"/api/semesters/{autumn['id']}", json={"endDate": "2026-12-27"}, headers=h).get_json()
    assert shorter["totalWeeks"] == 16
    bad = client.patch(f"/api/semesters/{autumn['id']}", json={"totalWeeks": 25}, headers=h)
    assert bad.status_code == 422

    # 非当前学期可以删除
    assert client.delete(f"/api/semesters/{autumn['id']}", headers=h).status_code == 204
    assert client.delete("/api/semesters/99999", headers=h).status_code == 404
    assert [s["id"] for s in client.get("/api/semesters", headers=h).get_json()] == [spring["id"]]
