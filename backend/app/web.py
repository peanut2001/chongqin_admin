"""生产单镜像中由 Flask 直接提供前端页面（前端打包产物在 WEB_DIST_DIR）；开发环境由 Vite 提供，不启用。

- /assets/*：文件名带内容哈希，长期缓存；
- 其他存在的静态文件（favicon、默认头像等）：缓存 1 天；
- 其余路径一律返回 index.html（前端路由），入口页不缓存；
- /api/* 不会落到这里：未匹配的接口仍返回 JSON 404；
- 打包时预压缩的 .gz（见 Dockerfile）在浏览器支持 gzip 时直接返回，省去运行时压缩；
- 入口页注入 <meta name="demo-accounts">：登录页是否显示演示账号按钮跟随运行时的 ALLOW_DEMO_LOGIN，
  同一个镜像打开 / 关闭演示登录都不需要重新打包。
"""

import mimetypes
from pathlib import Path

from flask import Flask, Response, abort, request, send_from_directory
from werkzeug.security import safe_join

YEAR = 365 * 24 * 3600
DAY = 24 * 3600
GZIP_SUFFIXES = {".js", ".css", ".svg", ".json", ".html"}
DEMO_META = '<meta name="demo-accounts" content="1" />'


def _index_html(root: Path, demo_login: bool) -> str:
    html = (root / "index.html").read_text(encoding="utf-8")
    return html.replace("</head>", f"    {DEMO_META}\n  </head>", 1) if demo_login else html


def _send_static(root: Path, path: str, max_age: int) -> Response:
    gz = root / f"{path}.gz"
    if (
        Path(path).suffix in GZIP_SUFFIXES
        and "gzip" in request.headers.get("Accept-Encoding", "")
        and gz.is_file()
    ):
        mimetype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        resp = send_from_directory(root, f"{path}.gz", mimetype=mimetype, max_age=max_age)
        resp.headers["Content-Encoding"] = "gzip"
    else:
        resp = send_from_directory(root, path, max_age=max_age)
    resp.headers["Vary"] = "Accept-Encoding"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    if max_age == YEAR:
        resp.headers["Cache-Control"] = f"public, max-age={YEAR}, immutable"
    return resp


def init_web(app: Flask) -> None:
    dist = app.config.get("WEB_DIST_DIR")
    if not dist:
        return
    root = Path(dist)
    if not (root / "index.html").is_file():
        raise RuntimeError(f"WEB_DIST_DIR={dist} 中没有 index.html，前端打包产物缺失。")
    index_html = _index_html(root, app.config["ALLOW_DEMO_LOGIN"])

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def web(path: str):
        if path == "api" or path.startswith("api/"):
            abort(404)
        if path and not path.endswith(".gz"):
            full = safe_join(str(root), path)
            if full and Path(full).is_file() and path != "index.html":
                return _send_static(root, path, YEAR if path.startswith("assets/") else DAY)
            if path.startswith("assets/"):
                abort(404)  # 旧版本的打包文件不要回退成入口页，否则浏览器会把 HTML 当脚本解析
        resp = Response(index_html, mimetype="text/html")
        resp.headers["Cache-Control"] = "no-cache"
        return resp
