import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type SchoolClassRow = {
  id: number
  name: string
  cohortYear: number | null
  studentCount: number
  isDemo: boolean
  createdAt: string
  /** 授课学期（最新的在前），在学期管理中调整 */
  semesters: { id: number; name: string; isCurrent: boolean }[]
}

export type ClassInput = { name: string; cohortYear: number | null }

export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => (await api.get<SchoolClassRow[]>('/classes')).data,
  })
}

/**
 * 班级变动会影响：班级列表、/meta 中的班级下拉、用户列表里的班级名、学情统计筛选，
 * 以及学期的授课班级（新建班级会自动加入当前学期）和教学总览人数
 */
function useInvalidateClasses() {
  const qc = useQueryClient()
  // 不返回 Promise：弹窗立即关闭，列表在后台刷新
  return () => {
    for (const key of [
      'classes',
      'meta',
      'users',
      'stats',
      'semesters',
      'dashboard',
    ]) {
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
