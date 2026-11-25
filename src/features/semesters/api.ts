import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { type Semester } from '@/lib/api/meta'

export type SemesterRow = Semester & { isCurrent: boolean }

export type SemesterInput = {
  name: string
  course: string
  startDate: string
  endDate: string
  /** 为空时后端按起止日期自动计算 */
  totalWeeks: number | null
}

export function useSemesters() {
  return useQuery({
    queryKey: ['semesters'],
    queryFn: async () => (await api.get<SemesterRow[]>('/semesters')).data,
  })
}

/** 学期变动会影响 /meta（当前学期、教学周）与所有统计 */
function useInvalidateSemesters() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['semesters', 'meta', 'stats', 'dashboard']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useCreateSemester() {
  const invalidate = useInvalidateSemesters()
  return useMutation({
    mutationFn: async (input: SemesterInput & { setCurrent: boolean }) =>
      (await api.post<SemesterRow>('/semesters', input)).data,
    onSuccess: invalidate,
    meta: { silent: true },
  })
}

export function useUpdateSemester() {
  const invalidate = useInvalidateSemesters()
  return useMutation({
    mutationFn: async ({ id, ...input }: SemesterInput & { id: number }) =>
      (await api.patch<SemesterRow>(`/semesters/${id}`, input)).data,
    onSuccess: invalidate,
    meta: { silent: true },
  })
}

export function useActivateSemester() {
  const invalidate = useInvalidateSemesters()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<SemesterRow>(`/semesters/${id}/activate`)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteSemester() {
  const invalidate = useInvalidateSemesters()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/semesters/${id}`)
    },
    onSuccess: invalidate,
  })
}

/** 起止日期（含两端）覆盖的周数，与后端计算一致 */
export function coveredWeeks(startDate: string, endDate: string) {
  const start = Date.parse(startDate)
  const end = Date.parse(endDate)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return Math.ceil((Math.round((end - start) / 86_400_000) + 1) / 7)
}
