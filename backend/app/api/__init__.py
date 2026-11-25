from flask import Flask


def register_blueprints(app: Flask) -> None:
    from app.api import ai, auth, cases, classes, health, me, media, meta, practice, semesters, stats, users

    for module in (health, auth, me, media, meta, users, classes, semesters, cases, practice, ai, stats):
        app.register_blueprint(module.bp, url_prefix="/api")
