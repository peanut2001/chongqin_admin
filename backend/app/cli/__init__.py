from flask import Flask


def register_cli(app: Flask) -> None:
    from app.cli.content import content_cli
    from app.cli.seed import seed_cli

    app.cli.add_command(content_cli)
    app.cli.add_command(seed_cli)
