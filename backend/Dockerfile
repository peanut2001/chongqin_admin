# 生产镜像：代码与病例图片打包进镜像，用 gunicorn 运行；启动时自动执行数据库迁移。
# 开发环境使用 Dockerfile.dev（源码挂载 + flask run）。
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_APP=wsgi:app \
    APP_CONFIG=prod \
    UPLOAD_DIR=/data/uploads \
    CONTENT_DIR=/app/content

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# 以非 root 用户运行；上传目录由数据卷挂载（首次挂载时继承这里的属主）
RUN useradd --system app \
    && mkdir -p /data/uploads \
    && chown app:app /data/uploads
USER app

EXPOSE 5000

# AI 判读与学情分析是同步请求（模型超时 90 秒），worker 超时要更长；
# 线程 worker 避免慢请求占满进程。登录限流记录在数据库里，多进程下同样生效。
# 不使用 gunicorn 的运行时控制接口（默认要在用户主目录创建 socket）。
CMD ["sh", "-c", "flask db upgrade && exec gunicorn wsgi:app --bind 0.0.0.0:5000 --worker-class gthread --workers ${GUNICORN_WORKERS:-2} --threads ${GUNICORN_THREADS:-8} --timeout 120 --no-control-socket --access-logfile -"]
