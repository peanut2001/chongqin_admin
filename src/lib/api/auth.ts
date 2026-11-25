import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { api, refreshSession, type SessionPayload } from './client'

export async function login(email: string, password: string) {
  const { data } = await api.post<SessionPayload>(
    '/auth/login',
    { email, password },
    { skipAuthRefresh: true }
  )
  useAuthStore.getState().auth.setSession(data.accessToken, data.user)
  return data.user
}

export async function logout() {
  try {
    await api.post('/auth/logout', undefined, { skipAuthRefresh: true })
  } finally {
    useAuthStore.getState().auth.reset()
  }
}

/**
 * 确保有可用会话：内存中已有 token 则直接返回；
 * 否则（如刷新页面后）用 refresh cookie 恢复。无法恢复时返回 null。
 */
export async function ensureSession(): Promise<AuthUser | null> {
  const { user, accessToken } = useAuthStore.getState().auth
  if (user && accessToken) return user
  const session = await refreshSession()
  return session?.user ?? null
}
