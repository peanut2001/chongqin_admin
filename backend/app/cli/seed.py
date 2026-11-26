"""演示数据：flask seed accounts | history | clear-demo | reset-demo | all

所有演示数据都标记 is_demo=true，clear-demo 只删除演示数据，绝不触碰真实数据。
"""

from datetime import date

import click
from flask.cli import AppGroup
from sqlalchemy import func, select

from app.extensions import db
from app.models import SchoolClass, Semester, User
from app.services.passwords import hash_password

seed_cli = AppGroup("seed", help="演示数据管理")

DEMO_PASSWORD = "demo1234"

SEMESTER = {
    "name": "2026-2027 学年第一学期",
    "course": "医学影像诊断学（研究生）",
    "start_date": date(2026, 9, 7),
    "end_date": date(2027, 1, 10),
    "total_weeks": 18,
}
CLASS_NAMES = ["2025 级影像硕士 1 班", "2025 级影像硕士 2 班"]

# (邮箱前缀, 姓, 名, 角色)
DEMO_STAFF = [
    ("admin", "王", "管理员", "admin"),
    ("teacher", "张", "老师", "teacher"),
]
# 30 名演示学生：学号 S2025001 起，前 15 人 1 班，后 15 人 2 班；student@demo.com 即 S2025001
STUDENT_NAMES = [
    ("李", "明"), ("王", "雪"), ("陈", "浩"), ("刘", "洋"), ("赵", "婷"),
    ("孙", "磊"), ("周", "敏"), ("吴", "迪"), ("郑", "悦"), ("黄", "凯"),
    ("林", "晨"), ("何", "静"), ("高", "远"), ("罗", "琳"), ("梁", "宇"),
    ("宋", "佳"), ("谢", "航"), ("韩", "露"), ("唐", "峰"), ("冯", "颖"),
    ("董", "涛"), ("萧", "然"), ("程", "曦"), ("曹", "睿"), ("袁", "菲"),
    ("邓", "博"), ("许", "诺"), ("傅", "岚"), ("沈", "毅"), ("彭", "瑶"),
]


def _get_user(email: str) -> User | None:
    return db.session.scalar(select(User).where(func.lower(User.email) == email.lower()))


def ensure_semester() -> Semester:
    sem = db.session.scalar(select(Semester).where(Semester.is_current.is_(True)))
    if sem is None:
        sem = Semester(is_current=True, **SEMESTER)
        db.session.add(sem)
    return sem


def ensure_classes() -> list[SchoolClass]:
    classes = []
    for name in CLASS_NAMES:
        cls = db.session.scalar(select(SchoolClass).where(SchoolClass.name == name))
        if cls is None:
            cls = SchoolClass(name=name, cohort_year=2025, is_demo=True)
            db.session.add(cls)
        classes.append(cls)
    db.session.flush()
    return classes


def seed_accounts() -> dict[str, int]:
    """幂等：按邮箱 / 学号判断是否已存在。"""
    sem = ensure_semester()
    classes = ensure_classes()
    # 演示班级作为当前学期的授课班级，学情统计才能统计到演示学生
    for cls in classes:
        if cls not in sem.classes:
            sem.classes.append(cls)
    created = 0
    pw = hash_password(DEMO_PASSWORD)

    for prefix, last, first, role in DEMO_STAFF:
        email = f"{prefix}@demo.com"
        if _get_user(email) is None:
            db.session.add(
                User(
                    email=email, username=prefix, first_name=first, last_name=last,
                    role=role, status="active", password_hash=pw, is_demo=True,
                )
            )
            created += 1

    for i, (last, first) in enumerate(STUDENT_NAMES, start=1):
        student_no = f"S2025{i:03d}"
        email = "student@demo.com" if i == 1 else f"{student_no.lower()}@demo.com"
        username = "student" if i == 1 else student_no.lower()
        existing = db.session.scalar(select(User).where(User.student_no == student_no))
        if existing is None and _get_user(email) is None:
            db.session.add(
                User(
                    email=email, username=username, first_name=first, last_name=last,
                    role="student", status="active", password_hash=pw,
                    student_no=student_no, class_id=classes[0 if i <= 15 else 1].id,
                    phone_number=f"+86 139 {i:04d} {(i * 37) % 10000:04d}",
                    is_demo=True,
                )
            )
            created += 1

    db.session.commit()
    total = db.session.scalar(select(func.count()).select_from(User))
    return {"created": created, "users": total}


def _echo(label: str, counts: dict) -> None:
    click.echo(f"{label}: " + ", ".join(f"{k}={v}" for k, v in counts.items()))


@seed_cli.command("accounts")
def accounts_cmd():
    """创建当前学期、2 个授课班级、演示账号（admin/teacher/student@demo.com）与 30 名演示学生。"""
    result = seed_accounts()
    click.echo(f"accounts: created {result['created']}, total users {result['users']}")
    click.echo(f"演示账号密码：{DEMO_PASSWORD}")


@seed_cli.command("history")
@click.option("--seed", "seed_value", default=42, show_default=True, help="随机种子（相同种子生成相同数据）")
def history_cmd(seed_value: int):
    """为演示学生生成本学期的练习、病例浏览与 AI 判读记录（会先清除旧的演示记录）。"""
    from app.cli.demo_history import seed_history

    _echo("history", seed_history(seed_value))


@seed_cli.command("clear-demo")
@click.option("--accounts", is_flag=True, help="同时删除演示账号与演示班级")
def clear_demo_cmd(accounts: bool):
    """清除演示学习记录（不影响真实数据）。"""
    from app.cli.demo_history import clear_demo_accounts, clear_demo_activity

    _echo("cleared", clear_demo_activity())
    if accounts:
        click.echo(f"removed demo accounts: {clear_demo_accounts()}")


@seed_cli.command("reset-demo")
@click.option("--seed", "seed_value", default=42, show_default=True)
def reset_demo_cmd(seed_value: int):
    """清除并重新生成演示学习记录。"""
    from app.cli.demo_history import seed_history

    _echo("history", seed_history(seed_value))


@seed_cli.command("all")
def all_cmd():
    """一键初始化演示环境：导入教学内容 + 演示账号 + 演示学习记录。"""
    from pathlib import Path

    from flask import current_app

    from app.cli.content import import_content
    from app.cli.demo_history import seed_history

    _echo("content", import_content(Path(current_app.config["CONTENT_DIR"])))
    result = seed_accounts()
    click.echo(f"accounts: created {result['created']}, total users {result['users']}")
    _echo("history", seed_history())
    click.echo(f"演示账号密码：{DEMO_PASSWORD}")
