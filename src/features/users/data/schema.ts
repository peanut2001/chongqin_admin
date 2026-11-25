import { type Role } from '@/lib/permissions'

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended'

/** 后端 /api/users 返回的用户 */
export type User = {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  status: UserStatus
  role: Role
  studentNo: string | null
  classId: number | null
  className: string | null
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type UsersPage = {
  items: User[]
  total: number
  page: number
  pageSize: number
  facets: {
    status: Partial<Record<UserStatus, number>>
    role: Partial<Record<Role, number>>
  }
}

export type UsersQuery = {
  page: number
  pageSize: number
  status: UserStatus[]
  role: Role[]
  username: string
  /** 如 createdAt.desc、username.asc */
  sort?: string
}

export type UserInput = {
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  role: Role
  /** 新建必填；编辑时留空表示不修改 */
  password?: string
  status?: UserStatus
  studentNo?: string | null
  classId?: number | null
}

export type BulkAction = 'delete' | 'activate' | 'deactivate' | 'suspend'

export type BulkResult = {
  affected: number
  skipped: { id: string; reason: 'self' | 'last_admin' | 'not_found' }[]
}
