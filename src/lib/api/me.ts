import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AuthUser, useAuthStore } from '@/stores/auth-store'
import { type User } from '@/features/users/data/schema'
import { api, type SessionPayload } from './client'

/** /api/me：完整个人资料 + 用于侧边栏的登录用户信息 */
export type MeProfile = User & { authUser: AuthUser }

const meKey = ['me'] as const

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => (await api.get<MeProfile>('/me')).data,
  })
}

/** 资料或头像变化后：刷新 /me 缓存，并同步侧边栏、右上角的登录用户 */
function useApplyProfile() {
  const qc = useQueryClient()
  return (profile: MeProfile) => {
    qc.setQueryData(meKey, profile)
    useAuthStore.getState().auth.setUser(profile.authUser)
  }
}

export function useUpdateMe() {
  const apply = useApplyProfile()
  return useMutation({
    mutationFn: async (input: {
      firstName: string
      lastName: string
      phoneNumber: string
    }) => (await api.patch<MeProfile>('/me', input)).data,
    onSuccess: apply,
    meta: { silent: true },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: {
      currentPassword: string
      newPassword: string
    }) => (await api.post<SessionPayload>('/me/password', input)).data,
    // 改密后旧令牌全部失效，后端为当前会话换发了新令牌
    onSuccess: (session) =>
      useAuthStore
        .getState()
        .auth.setSession(session.accessToken, session.user),
    meta: { silent: true },
  })
}

export function useUploadAvatar() {
  const apply = useApplyProfile()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return (await api.put<MeProfile>('/me/avatar', form)).data
    },
    onSuccess: apply,
    meta: { silent: true },
  })
}

export function useDeleteAvatar() {
  const apply = useApplyProfile()
  return useMutation({
    mutationFn: async () => (await api.delete<MeProfile>('/me/avatar')).data,
    onSuccess: apply,
  })
}
