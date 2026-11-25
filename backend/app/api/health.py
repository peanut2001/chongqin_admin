from flask import Blueprint
from sqlalchemy import text

from app.extensions import db

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}, 200 if db_ok else 503
