import { create } from 'zustand'
import { type Role } from '@/lib/permissions'

/** 登录用户（来自后端 /auth/login、/auth/refresh 的 user 字段） */
export interface AuthUser {
  id: string
  name: string
  email: string
  username: string
  role: Role
  avatarUrl: string | null
  studentNo: string | null
  className: string | null
}

interface AuthState {
  auth: {
    user: AuthUser | null
    /** access token 只保存在内存中；刷新页面后由 httpOnly refresh cookie 换回 */
    accessToken: string
    setSession: (accessToken: string, user: AuthUser) => void
    setUser: (user: AuthUser) => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    accessToken: '',
    setSession: (accessToken, user) =>
      set((state) => ({
        ...state,
        auth: { ...state.auth, accessToken, user },
      })),
    setUser: (user) =>
      set((state) => ({ ...state, auth: { ...state.auth, user } })),
    reset: () =>
      set((state) => ({
        ...state,
        auth: { ...state.auth, user: null, accessToken: '' },
      })),
  },
}))
