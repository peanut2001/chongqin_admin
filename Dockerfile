# 生产单镜像：前端打包产物与后端放在同一个镜像里，由 gunicorn + Flask 一起提供（页面 + /api）。
# 数据库使用官方 PostgreSQL 镜像；HTTPS 由服务器上的反向代理负责。部署见 deploy/README.md。
# 开发环境使用 Dockerfile.dev 与 backend/Dockerfile.dev。

# ===== 1. 打包前端 =====
FROM node:22-alpine AS web

WORKDIR /web

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 只复制前端需要的文件，后端改动不会让前端重新打包
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
# 打包后预压缩文本资源，后端按 Accept-Encoding 直接返回 .gz
RUN pnpm build \
    && find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' \) -size +1k \
       | while read -r f; do gzip -9 -c "$f" > "$f.gz"; done

# ===== 2. 运行镜像 =====
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_APP=wsgi:app \
    APP_CONFIG=prod \
    UPLOAD_DIR=/data/uploads \
    CONTENT_DIR=/app/content \
    WEB_DIST_DIR=/app/web

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
COPY --from=web /web/dist /app/web

# 以非 root 用户运行；上传目录由数据卷挂载（首次挂载时继承这里的属主）
RUN useradd --system app \
    && mkdir -p /data/uploads \
    && chown app:app /data/uploads
USER app

EXPOSE 8000

# AI 判读与学情分析是同步请求（模型超时 90 秒），worker 超时要更长；线程 worker 避免慢请求占满进程。
# 登录限流记录在数据库里，多进程下同样生效。不使用 gunicorn 的运行时控制接口。
CMD ["sh", "-c", "flask db upgrade && exec gunicorn wsgi:app --bind 0.0.0.0:8000 --worker-class gthread --workers ${GUNICORN_WORKERS:-2} --threads ${GUNICORN_THREADS:-8} --timeout 120 --no-control-socket --access-logfile -"]
