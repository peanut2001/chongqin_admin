/**
 * 后端 API 客户端（axios）
 *
 * - baseURL 为 /api：开发时由 Vite 代理、生产时由 nginx 代理到 Flask，前后端同源。
 * - access token 只存在内存（auth-store），由请求拦截器放入 Authorization 头。
 * - access token 过期（401 token_expired）时，用 httpOnly 的 refresh cookie 换新 token，
 *   并发请求共用同一次刷新（single-flight），刷新成功后原请求只重试一次。
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { type AuthUser, useAuthStore } from '@/stores/auth-store'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  // 数组参数序列化为 status=a&status=b（Flask 的 getlist 才能读到），而不是 status[]=a
  paramsSerializer: { indexes: null },
})

export type ApiErrorBody = {
  title?: string
  code?: string
  fields?: Record<string, string>
}

export type SessionPayload = {
  accessToken: string
  accessTokenExpiresAt: string
  user: AuthUser
}

/** 会话彻底失效（刷新失败 / 账号被停用）时的处理，由 main.tsx 注册（清缓存、跳转登录页） */
let onSessionExpired: (reason?: string) => void = () => {}
export function setSessionExpiredHandler(fn: (reason?: string) => void) {
  onSessionExpired = fn
}

let refreshing: Promise<SessionPayload | null> | null = null

/** 用 refresh cookie 换取新的 access token；并发调用只发一次请求 */
export function refreshSession(): Promise<SessionPayload | null> {
  refreshing ??= api
    .post<SessionPayload>('/auth/refresh', undefined, { skipAuthRefresh: true })
    .then(({ data }) => {
      useAuthStore.getState().auth.setSession(data.accessToken, data.user)
      return data
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const code = error.response?.data?.code

    if (status !== 401 || !config || config.skipAuthRefresh) {
      return Promise.reject(error)
    }

    // access token 过期：刷新后重试一次
    if (code === 'token_expired' && !config._retried) {
      config._retried = true
      const session = await refreshSession()
      if (session) return api(config)
    }

    // 账号被停用、令牌被吊销或刷新失败：会话结束
    useAuthStore.getState().auth.reset()
    onSessionExpired(error.response?.data?.title)
    return Promise.reject(error)
  }
)

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 不参与 401 自动刷新（登录、刷新、退出等接口自身） */
    skipAuthRefresh?: boolean
  }
}

/** 从接口错误中取出后端返回的提示文字 */
export function apiErrorTitle(
  error: unknown,
  fallback = '操作失败，请稍后重试。'
) {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorBody | undefined)?.title ?? fallback
  }
  return fallback
}

/** 后端 422/409 返回的字段错误，用于 react-hook-form 的 setError */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorBody | undefined)?.fields ?? {}
  }
  return {}
}
