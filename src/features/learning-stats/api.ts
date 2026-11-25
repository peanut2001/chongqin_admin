import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { type Semester } from '@/lib/api/meta'

/** 统计口径见 backend/app/services/stats.py */

export type WeeklyActivity = {
  week: string
  weekIndex: number
  /** 该周作答题数 */
  practice: number
  caseViews: number
  aiReads: number
  /** 该周正确率；无作答时为 null（图表留空） */
  accuracy: number | null
}

export type ChapterMastery = { setId: string; chapter: string; mastery: number }

export type ModuleUsage = { key: string; name: string; value: number }

export type RecentActivity = {
  name: string
  action: string
  detail: string | null
  time: string
}

export type StudentStat = {
  /** 学号（无学号时为用户名） */
  id: string
  userId: string
  name: string
  className: string | null
  studyHours: number
  practiceCount: number
  accuracy: number | null
  caseViews: number
  aiReads: number
  lastActive: string | null
  needsAttention: boolean
}

export type Kpis = {
  studentCount: number
  avgAccuracy: number | null
  totalPractice: number
  totalCaseViews: number
  totalAiReads: number
  avgStudyHours: number
  needsAttention: number
}

export type StatsOverview = {
  semester: Semester
  kpis: Kpis & { activeStudents7d: number; attentionHoursThreshold: number }
  weeklyActivity: WeeklyActivity[]
  chapterMastery: ChapterMastery[]
  moduleUsage: ModuleUsage[]
  recentActivities: RecentActivity[]
}

export type Dashboard = {
  semester: Semester
  /** class：教师 / 管理员看全体学生；personal：学生只看自己 */
  scope: 'class' | 'personal'
  caseCount: number
  systemCount: number
  questionCount: number
  questionSetCount: number
  studentCount: number
  kpis: Kpis
  weeklyActivity: WeeklyActivity[]
  recentActivities?: RecentActivity[]
  chapterMastery?: ChapterMastery[]
  moduleUsage?: ModuleUsage[]
}

export function useStatsOverview(classId?: number) {
  return useQuery({
    queryKey: ['stats', 'overview', classId ?? 'all'],
    queryFn: async () =>
      (await api.get<StatsOverview>('/stats/overview', { params: { classId } }))
        .data,
  })
}

export function useStudentStats(classId?: number) {
  return useQuery({
    queryKey: ['stats', 'students', classId ?? 'all'],
    queryFn: async () =>
      (await api.get<StudentStat[]>('/stats/students', { params: { classId } }))
        .data,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/dashboard')).data,
  })
}

const dateTimeFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 HH:mm / MM-DD HH:mm */
export function formatRelativeTime(iso: string | null, now = new Date()) {
  if (!iso) return '—'
  const t = new Date(iso)
  const minutes = Math.floor((now.getTime() - t.getTime()) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 24 * 60 && t.getDate() === now.getDate()) {
    return `${Math.floor(minutes / 60)} 小时前`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (t.toDateString() === yesterday.toDateString()) {
    return `昨天 ${t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  return dateTimeFmt.format(t)
}
