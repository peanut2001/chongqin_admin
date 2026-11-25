import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type SchoolClassRow = {
  id: number
  name: string
  cohortYear: number | null
  studentCount: number
  isDemo: boolean
  createdAt: string
}

export type ClassInput = { name: string; cohortYear: number | null }

export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => (await api.get<SchoolClassRow[]>('/classes')).data,
  })
}

/** 班级变动会影响：班级列表、/meta 中的班级下拉、用户列表里的班级名、学情统计筛选 */
function useInvalidateClasses() {
  const qc = useQueryClient()
  // 不返回 Promise：弹窗立即关闭，列表在后台刷新
  return () => {
    for (const key of ['classes', 'meta', 'users', 'stats']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useCreateClass() {
  const invalidate = useInvalidateClasses()
  return useMutation({
    mutationFn: async (input: ClassInput) =>
      (await api.post<SchoolClassRow>('/classes', input)).data,
    onSuccess: invalidate,
    // 字段错误由表单展示
    meta: { silent: true },
  })
}

export function useUpdateClass() {
  const invalidate = useInvalidateClasses()
  return useMutation({
    mutationFn: async ({ id, ...input }: ClassInput & { id: number }) =>
      (await api.patch<SchoolClassRow>(`/classes/${id}`, input)).data,
    onSuccess: invalidate,
    meta: { silent: true },
  })
}

export function useDeleteClass() {
  const invalidate = useInvalidateClasses()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/classes/${id}`)
    },
    onSuccess: invalidate,
  })
}
