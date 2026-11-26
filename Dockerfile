# 生产镜像：先打包前端，再由 nginx 提供静态文件，并把 /api 转发到后端（前后端同源）。
# 开发环境使用 Dockerfile.dev（Vite 开发服务器）。
FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# 登录页是否显示「演示账号」快捷按钮（打包时确定），与后端 ALLOW_DEMO_LOGIN 保持一致
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN pnpm build

FROM nginx:stable-alpine

# 官方镜像启动时会用环境变量（SERVER_NAME）替换模板，生成 /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
