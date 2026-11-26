# 生产部署

应用打包成一个镜像 `ghcr.io/peanut2001/chongqin_admin`（前端页面 + 后端接口），由 GitHub Actions 自动构建：

- 推送到 `main`：发布 `latest` 和提交短哈希（如 `716ef12`）两个标签；
- 推送 `v*` 标签（如 `v1.0.0`）：额外发布版本号标签（`1.0.0`）；
- 同时提供 amd64 和 arm64 架构。

服务器上运行两个容器：

| 容器 | 作用 | 端口 |
|---|---|---|
| app | 应用；启动时自动执行数据库迁移 | 默认只监听本机 `127.0.0.1:8000` |
| db | PostgreSQL 16，数据在 `pg_data` 卷里 | 不开放 |

HTTPS 由服务器上的反向代理负责（宝塔 / 1Panel / nginx），转发到 `127.0.0.1:8000`。

**服务器上只需要两个文件**：`docker-compose.prod.yml` 和 `.env.prod`，不需要源码。以下 `dc` 代表：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod
```

## 1. 准备配置

把仓库里的 `docker-compose.prod.yml` 和 `.env.prod.example` 放到服务器的部署目录，然后：

```bash
cp .env.prod.example .env.prod
# 用 openssl rand -hex 32 生成 POSTGRES_PASSWORD、JWT_SECRET_KEY、MEDIA_SIGNING_KEY、MODEL_KEY_SECRET 并填入
```

密钥缺失或仍是开发默认值时，app 容器会启动失败，并在日志中说明原因（`dc logs app`）。

## 2. 恢复演示数据（从开发环境迁移）

在开发电脑上导出（Windows 的 Git Bash 会把 `/tmp/...` 改写成 Windows 路径，需先执行 `export MSYS_NO_PATHCONV=1`；PowerShell 不需要）：

```bash
docker exec chongqin_admin-db-1 pg_dump -U chongqin -d chongqin -Fc -f /tmp/chongqin.dump
docker cp chongqin_admin-db-1:/tmp/chongqin.dump ./chongqin.dump
```

把 `chongqin.dump` 上传到服务器部署目录，然后：

```bash
dc up -d db
dc cp chongqin.dump db:/tmp/chongqin.dump
dc exec db pg_restore -U chongqin -d chongqin --clean --if-exists --no-owner /tmp/chongqin.dump
```

不迁移数据、从零初始化时跳过这一步，改为在第 3 步之后执行 `dc exec app flask seed all`。

## 3. 拉取镜像并启动

```bash
dc pull
dc up -d
dc ps            # 两个容器都应为 running，db 为 healthy
dc logs -f app   # 查看应用日志
curl http://127.0.0.1:8000/api/health   # {"status": "ok", "db": true}
```

从 ghcr.io 拉取很慢时，可以在网络好的机器上 `docker pull` 后用 `docker save` / `docker load` 拷过去。

## 4. 配置反向代理（HTTPS）

宝塔 / 1Panel：新建站点并申请 SSL 证书，添加反向代理，目标地址 `http://127.0.0.1:8000`。

手写 nginx 时参考：

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name example.com;
    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    client_max_body_size 10m;          # 与应用的上传上限一致

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 130s;       # AI 判读同步等待模型返回（最长 90 秒）
    }
}
```

`.env.prod` 里的 `TRUSTED_PROXIES=1` 表示前面有一层反向代理，应用会从 `X-Forwarded-For` 末尾取真实客户端 IP（登录限流、审计日志用），客户端伪造的部分不会被采用。

## 5. 启动后检查

1. 打开 `https://域名`，用管理员账号登录。
2. **设置 → AI 模型：重新填写 API Key 并保存。** 生产环境的 `MODEL_KEY_SECRET` 与开发环境不同，从开发库迁移过来的 Key 无法解密；不重新填写的话，AI 判读和 AI 学情分析会提示「已保存的 API Key 无法读取」。
3. 看一下教学总览、学情统计、病例库、题库练习、AI 图像判读是否正常。

## 更新版本

```bash
dc pull
dc up -d
```

数据库迁移在 app 容器启动时自动执行。要固定某个版本，把 `.env.prod` 的 `APP_VERSION` 改为提交短哈希或版本号。

## 演示结束后

`.env.prod` 中把 `ALLOW_DEMO_LOGIN` 改为 `false`，再执行 `dc up -d`（不需要重新打包，登录页的演示账号按钮会一起隐藏）。演示账号密码是公开的，开放期间任何知道网址的人都能用演示管理员账号登录。

## 本地构建镜像（可选）

```bash
docker build -t ghcr.io/peanut2001/chongqin_admin:local .
# .env.prod 中设置 APP_VERSION=local 后 dc up -d
```
