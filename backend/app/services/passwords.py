from werkzeug.security import check_password_hash, generate_password_hash

# 用户不存在时也做一次同等开销的校验，避免通过响应时间判断邮箱是否注册
_DUMMY_HASH = generate_password_hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        check_password_hash(_DUMMY_HASH, password)
        return False
    return check_password_hash(password_hash, password)
