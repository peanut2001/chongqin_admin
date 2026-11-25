/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 地址，默认 /api（同源代理） */
  readonly VITE_API_BASE_URL?: string
  /** 设为 'true' 时在正式构建的登录页显示演示账号按钮（仅用于演示环境） */
  readonly VITE_SHOW_DEMO_ACCOUNTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
