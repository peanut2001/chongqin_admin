import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export type Semester = {
  id: number
  name: string
  course: string
  startDate: string
  endDate: string
  totalWeeks: number
  /** 后端按当前日期计算的教学周 */
  currentWeek: number
}

export type SchoolClass = { id: number; name: string; studentCount: number }

export type Meta = {
  semester: Semester | null
  classes: SchoolClass[]
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: async () => (await api.get<Meta>('/meta')).data,
    staleTime: 5 * 60 * 1000,
  })
}
