"""用户管理命令：flask users create-admin

正式部署时用来创建第一个管理员（不依赖演示数据），之后的账号都可以由管理员在页面上开通。
密码默认交互输入（不回显、需确认），不会留在命令历史里。

示例：
    flask users create-admin --email admin@school.edu.cn --last-name 王 --first-name 老师
"""

import re

import click
from flask.cli import AppGroup

from app.errors import ApiError
from app.extensions import db
from app.models import User
from app.services import audit
from app.services.passwords import hash_password, password_problem
from app.services.users import check_conflicts

users_cli = AppGroup("users", help="用户管理")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _fail(message: str) -> None:
    raise click.ClickException(message)


@users_cli.command("create-admin")
@click.option("--email", prompt="邮箱", help="登录邮箱")
@click.option("--last-name", prompt="姓", help="姓")
@click.option("--first-name", prompt="名", help="名")
@click.option("--username", default=None, help="用户名，默认取邮箱 @ 前面的部分")
@click.password_option(
    "--password",
    prompt="密码",
    confirmation_prompt="再次输入密码",
    help="不建议在命令行直接写密码（会留在命令历史里），省略则交互输入",
)
def create_admin(email: str, last_name: str, first_name: str, username: str | None, password: str) -> None:
    """创建一个启用状态的管理员账号。"""
    email = email.strip()
    last_name, first_name = last_name.strip(), first_name.strip()
    username = (username or re.sub(r"[^a-zA-Z0-9_.-]", "", email.split("@")[0])).strip()

    if not EMAIL_RE.match(email) or len(email) > 254:
        _fail("邮箱格式不正确。")
    if not first_name or len(first_name) > 50 or len(last_name) > 50:
        _fail("姓名不能为空，且每部分不超过 50 个字符。")
    if not username or len(username) > 50:
        _fail("无法从邮箱生成用户名，请用 --username 指定。")
    problem = password_problem(password)
    if problem:
        _fail(problem)
    try:
        check_conflicts(email, username, None)
    except ApiError as err:
        reasons = "；".join((err.fields or {}).values()) or err.title
        hint = "（可用 --username 换一个用户名）" if err.fields and "username" in err.fields else ""
        _fail(f"{reasons}{hint}")

    user = User(
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        role="admin",
        status="active",
        password_hash=hash_password(password),
    )
    db.session.add(user)
    db.session.flush()
    audit.log("user.create_admin_cli", None, "user", str(user.id), {"email": user.email})
    db.session.commit()
    click.echo(f"已创建管理员：{user.display_name}（{email}，用户名 {username}）")
