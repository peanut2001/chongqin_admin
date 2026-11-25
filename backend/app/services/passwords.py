import re

from werkzeug.security import check_password_hash, generate_password_hash


def password_problem(password: str) -> str | None:
    """密码强度规则（与前端表单一致）。返回不符合的原因，符合时返回 None。"""
    if len(password) < 8:
        return "密码长度至少为 8 个字符。"
    if not re.search(r"[a-z]", password):
        return "密码必须包含至少一个小写字母。"
    if not re.search(r"\d", password):
        return "密码必须包含至少一个数字。"
    return None

# 用户不存在时也做一次同等开销的校验，避免通过响应时间判断邮箱是否注册
_DUMMY_HASH = generate_password_hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        check_password_hash(_DUMMY_HASH, password)
        return False
    return check_password_hash(password_hash, password)
