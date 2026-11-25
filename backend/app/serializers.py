"""模型 → 前端 JSON（camelCase）。只在这里决定哪些字段对外可见。"""

from app.models import User
from app.services.timeutil import iso


def avatar_url(user: User) -> str | None:
    if not user.avatar_upload_id:
        return None
    # 头像地址由不可猜测的上传 id 构成，换头像即换 id（可长期缓存）
    return f"/api/media/avatars/{user.avatar_upload_id}"


def auth_user(user: User) -> dict:
    """登录态用户（侧边栏、右上角、权限判断用）。"""
    return {
        "id": str(user.id),
        "name": user.display_name,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "avatarUrl": avatar_url(user),
        "studentNo": user.student_no,
        "className": user.school_class.name if user.school_class else None,
    }


def user_full(user: User) -> dict:
    """用户管理列表 / 个人资料。"""
    return {
        "id": str(user.id),
        "firstName": user.first_name,
        "lastName": user.last_name,
        "username": user.username,
        "email": user.email,
        "phoneNumber": user.phone_number,
        "status": user.status,
        "role": user.role,
        "studentNo": user.student_no,
        "classId": user.class_id,
        "className": user.school_class.name if user.school_class else None,
        "avatarUrl": avatar_url(user),
        "lastLoginAt": iso(user.last_login_at),
        "createdAt": iso(user.created_at),
        "updatedAt": iso(user.updated_at),
    }
