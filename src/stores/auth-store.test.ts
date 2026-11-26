import { clearCookies } from '@/test-utils/cookies'
import { beforeEach, describe, expect, it } from 'vitest'
import { type AuthUser, useAuthStore } from './auth-store'

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

function storedText() {
  return [
    document.cookie,
    ...Object.entries(localStorage).flat(),
    ...Object.entries(sessionStorage).flat(),
  ].join('\n')
}

describe('useAuthStore', () => {
  // 浏览器模式使用原生 ES 模块，vi.resetModules 不能让模块重新执行；每个用例前手动清空状态
  beforeEach(() => {
    clearCookies()
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.getState().auth.reset()
  })

  it('starts without a session', () => {
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('setSession stores token and user in memory only', () => {
    useAuthStore.getState().auth.setSession('access-token', { ...sampleUser })

    expect(useAuthStore.getState().auth.accessToken).toBe('access-token')
    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
    // 不写入 cookie / localStorage / sessionStorage：刷新页面后只能凭 httpOnly refresh cookie 换回
    expect(storedText()).not.toContain('access-token')
    expect(storedText()).not.toContain(sampleUser.email)
  })

  it('setUser updates the signed-in user and keeps the token', () => {
    useAuthStore.getState().auth.setSession('t', { ...sampleUser })

    useAuthStore.getState().auth.setUser({ ...sampleUser, name: '新名字' })

    expect(useAuthStore.getState().auth.user?.name).toBe('新名字')
    expect(useAuthStore.getState().auth.accessToken).toBe('t')
  })

  it('reset clears user and token', () => {
    useAuthStore.getState().auth.setSession('t', { ...sampleUser })

    useAuthStore.getState().auth.reset()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBe('')
  })
})
