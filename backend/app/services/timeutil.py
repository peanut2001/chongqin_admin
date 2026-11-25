from datetime import UTC, datetime


def now_utc() -> datetime:
    return datetime.now(UTC)


def iso(dt: datetime | None) -> str | None:
    """ISO 8601，统一以 Z 结尾的 UTC 时间。"""
    if dt is None:
        return None
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")
