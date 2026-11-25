import { create } from 'zustand'
import { type User, type UserStatus } from './schema'
import { DEFAULT_PASSWORD, users as initialUsers } from './users'

/**
 * 用户 mock 数据仓库：只存在内存中，刷新页面后恢复为初始数据。
 * 接入后端后，把这里的方法换成接口请求即可。
 */
type UsersState = {
  users: User[]
  /** 单独修改过密码的用户（id → 密码），其余用户使用 DEFAULT_PASSWORD */
  passwords: Record<string, string>
  addUser: (user: User, password?: string) => void
  updateUser: (id: string, patch: Partial<User>, password?: string) => void
  setStatus: (ids: string[], status: UserStatus) => void
  removeUsers: (ids: string[]) => void
}

export const useUsersStore = create<UsersState>()((set) => ({
  users: initialUsers,
  passwords: {},
  addUser: (user, password) =>
    set((state) => ({
      users: [user, ...state.users],
      passwords: password
        ? { ...state.passwords, [user.id]: password }
        : state.passwords,
    })),
  updateUser: (id, patch, password) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, ...patch, updatedAt: new Date() } : u
      ),
      passwords: password
        ? { ...state.passwords, [id]: password }
        : state.passwords,
    })),
  setStatus: (ids, status) =>
    set((state) => ({
      users: state.users.map((u) =>
        ids.includes(u.id) ? { ...u, status, updatedAt: new Date() } : u
      ),
    })),
  removeUsers: (ids) =>
    set((state) => ({
      users: state.users.filter((u) => !ids.includes(u.id)),
    })),
}))

const statusErrors: Record<Exclude<UserStatus, 'active'>, string> = {
  inactive: '该账号未激活，请联系管理员。',
  invited: '该账号尚未接受邀请，请联系管理员。',
  suspended: '该账号已被停用，请联系管理员。',
}

/** mock 登录校验：成功返回用户，失败抛出带提示信息的错误 */
export function authenticate(email: string, password: string): User {
  const { users, passwords } = useUsersStore.getState()
  const user = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  )
  if (!user || (passwords[user.id] ?? DEFAULT_PASSWORD) !== password) {
    throw new Error('邮箱或密码错误。')
  }
  if (user.status !== 'active') {
    throw new Error(statusErrors[user.status])
  }
  return user
}

export function emailExists(email: string, excludeId?: string): boolean {
  const target = email.trim().toLowerCase()
  return useUsersStore
    .getState()
    .users.some((u) => u.id !== excludeId && u.email.toLowerCase() === target)
}
