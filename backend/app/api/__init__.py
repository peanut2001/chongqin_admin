from flask import Flask


def register_blueprints(app: Flask) -> None:
    from app.api import ai, auth, cases, health, me, media, meta, practice, stats, users

    for module in (health, auth, me, media, meta, users, cases, practice, ai, stats):
        app.register_blueprint(module.bp, url_prefix="/api")
