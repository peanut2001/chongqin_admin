# 生产部署

服务器只需要安装 Docker（含 compose 插件）。一共三个容器：

| 容器 | 作用 | 对外端口 |
|---|---|---|
| web | nginx：前端静态文件、HTTPS、把 `/api` 转发到后端 | 80（跳转到 HTTPS）、443 |
| api | Flask + gunicorn；启动时自动执行数据库迁移 | 不开放 |
| db | PostgreSQL 16，数据在 `pg_data` 卷里 | 不开放 |

以下命令都在项目根目录执行，`dc` 代表：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod
```

## 1. 准备配置和证书

```bash
cp .env.prod.example .env.prod
# 填写 SERVER_NAME，并用 openssl rand -hex 32 生成 POSTGRES_PASSWORD、JWT_SECRET_KEY、MEDIA_SIGNING_KEY、MODEL_KEY_SECRET
```

把域名证书（nginx 格式）放到 `deploy/certs/`，文件名改为：

- `fullchain.pem`：证书（含证书链）
- `privkey.pem`：私钥

密钥缺失或仍是开发默认值时，api 容器会启动失败，并在日志中说明原因（`dc logs api`）。

## 2. 恢复演示数据（从开发环境迁移）

在开发电脑上导出（Windows 的 Git Bash 会把 `/tmp/...` 改写成 Windows 路径，需先执行 `export MSYS_NO_PATHCONV=1`；PowerShell 不需要）：

```bash
docker exec chongqin_admin-db-1 pg_dump -U chongqin -d chongqin -Fc -f /tmp/chongqin.dump
docker cp chongqin_admin-db-1:/tmp/chongqin.dump ./chongqin.dump
```

把 `chongqin.dump` 上传到服务器项目根目录，然后：

```bash
dc up -d db
dc cp chongqin.dump db:/tmp/chongqin.dump
dc exec db pg_restore -U chongqin -d chongqin --clean --if-exists --no-owner /tmp/chongqin.dump
```

不迁移数据、从零初始化时跳过这一步，改为在第 3 步之后执行 `dc exec api flask seed all`。

## 3. 构建并启动

```bash
dc up -d --build
dc ps          # 三个容器都应为 running / healthy
dc logs -f api # 查看后端日志
```

## 4. 启动后检查

1. 打开 `https://域名`，用管理员账号登录。
2. **设置 → AI 模型：重新填写 API Key 并保存。** 生产环境的 `MODEL_KEY_SECRET` 与开发环境不同，从开发库迁移过来的 Key 无法解密；不重新填写的话，AI 判读和 AI 学情分析会提示「已保存的 API Key 无法读取」。
3. 看一下教学总览、学情统计、病例库、题库练习、AI 图像判读是否正常。

## 更新版本

```bash
git pull
dc up -d --build
```

数据库迁移在 api 容器启动时自动执行。

## 演示结束后

`.env.prod` 中把 `ALLOW_DEMO_LOGIN` 改为 `false`，再执行 `dc up -d --build`。演示账号密码是公开的，开放期间任何知道网址的人都能用演示管理员账号登录。
