import { clearCookies } from '@/test-utils/cookies'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type AuthUser } from './auth-store'

async function importAuthStore() {
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser: AuthUser = {
  id: 'u-1',
  name: '李明',
  email: 'user@example.com',
  username: 'liming',
  role: 'student',
  avatarUrl: null,
  studentNo: 'S2025001',
  className: '1 班',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    clearCookies()
    vi.resetModules()
  })

  it('starts without a session', async () => {
    const useAuthStore = await importAuthStore()

    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('setSession stores token and user in memory only', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setSession('access-token', { ...sampleUser })

    expect(useAuthStore.getState().auth.accessToken).toBe('access-token')
    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
    // access token 不写入任何 JS 可读的 cookie
    expect(document.cookie).not.toContain('access-token')

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()
    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe('')
  })

  it('setUser updates the signed-in user and keeps the token', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setSession('t', { ...sampleUser })

    useAuthStore.getState().auth.setUser({ ...sampleUser, name: '新名字' })

    expect(useAuthStore.getState().auth.user?.name).toBe('新名字')
    expect(useAuthStore.getState().auth.accessToken).toBe('t')
  })

  it('reset clears user and token', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setSession('t', { ...sampleUser })

    useAuthStore.getState().auth.reset()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBe('')
  })
})
