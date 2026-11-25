import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import {
  type BulkAction,
  type BulkResult,
  type User,
  type UserInput,
  type UsersPage,
  type UsersQuery,
} from './data/schema'

export const usersKeys = {
  all: ['users'] as const,
  list: (q: UsersQuery) => ['users', 'list', q] as const,
}

export function useUsers(q: UsersQuery) {
  return useQuery({
    queryKey: usersKeys.list(q),
    queryFn: async () =>
      (await api.get<UsersPage>('/users', { params: q })).data,
    // 翻页 / 筛选时保留上一页数据，避免表格闪烁
    placeholderData: keepPreviousData,
  })
}

/** 用户相关写操作成功后刷新列表 */
function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: usersKeys.all })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (input: UserInput) =>
      (await api.post<User>('/users', input)).data,
    onSuccess: invalidate,
    // 字段错误由表单自行展示，不弹全局提示
    meta: { silent: true },
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<UserInput> & { id: string }) =>
      (await api.patch<User>(`/users/${id}`, input)).data,
    onSuccess: invalidate,
    meta: { silent: true },
  })
}

export function useInviteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (input: { email: string; role: string }) =>
      (await api.post<User>('/users/invite', input)).data,
    onSuccess: invalidate,
    meta: { silent: true },
  })
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: invalidate,
  })
}

export function useBulkUsers() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (input: { action: BulkAction; ids: string[] }) =>
      (await api.post<BulkResult>('/users/bulk', input)).data,
    onSuccess: invalidate,
  })
}
