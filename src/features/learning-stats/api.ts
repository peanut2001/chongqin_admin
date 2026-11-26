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

/* ===================== 单个学生详情与 AI 学情分析 ===================== */

/** 人均指标（正确率按题数加权） */
export type PerCapita = {
  studyHours: number
  practiceCount: number
  accuracy: number | null
  caseViews: number
  aiReads: number
}

export type StudentDetail = {
  student: StudentStat
  currentWeek: number
  attentionHoursThreshold: number
  attentionAccuracy: number
  /** 对比基准：「班级平均」或（未分班时）「全体平均」 */
  peerLabel: string
  peer: PerCapita
  weeklyActivity: WeeklyActivity[]
  /** mastery 为 null 表示该生还没练习这一章 */
  chapterMastery: (Omit<ChapterMastery, 'mastery'> & {
    mastery: number | null
    peerMastery: number
  })[]
  moduleUsage: ModuleUsage[]
  aiAgreement: Record<'一致' | '部分一致' | '不一致' | '未自评', number>
}

type AdviceMeta = {
  /** 未启用 AI 模型时为规则生成的演示结果 */
  isDemo: boolean
  modelName: string | null
  disclaimer: string
  generatedAt: string
}

export type GroupAdvice = AdviceMeta & {
  summary: string
  issues: { title: string; detail: string }[]
  focusStudents: {
    userId: string
    studentNo: string
    name: string
    reason: string
  }[]
  suggestions: string[]
}

export type StudentAdvice = AdviceMeta & {
  summary: string
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  /** 写给学生本人的学习建议 */
  message: string
}

export function useStudentDetail(userId: string | null) {
  return useQuery({
    queryKey: ['stats', 'student', userId],
    queryFn: async () =>
      (await api.get<StudentDetail>(`/stats/students/${userId}`)).data,
    enabled: userId !== null,
  })
}

// AI 分析耗时且计费：同一范围 10 分钟内复用结果，失败不自动重试
const ADVICE_CACHE = 10 * 60 * 1000

export function useGroupAdvice(userIds: string[], enabled: boolean) {
  const ids = [...userIds].sort()
  return useQuery({
    queryKey: ['stats', 'ai-advice', 'group', ids.join(',')],
    queryFn: async () =>
      (await api.post<GroupAdvice>('/stats/ai-advice', { userIds: ids })).data,
    enabled: enabled && ids.length > 0,
    staleTime: ADVICE_CACHE,
    gcTime: ADVICE_CACHE,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

/** 不自动请求：由「生成分析」按钮调用 refetch()；已生成过的结果直接从缓存显示 */
export function useStudentAdvice(userId: string | null) {
  return useQuery({
    queryKey: ['stats', 'ai-advice', 'student', userId],
    queryFn: async () =>
      (await api.post<StudentAdvice>(`/stats/students/${userId}/ai-advice`))
        .data,
    enabled: false,
    staleTime: ADVICE_CACHE,
    gcTime: ADVICE_CACHE,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export type MyStats = Omit<StatsOverview, 'kpis' | 'recentActivities'> & {
  kpis: Kpis
}

/** 学生本人的学情（章节掌握度、模块时长等） */
export function useMyStats(enabled = true) {
  return useQuery({
    queryKey: ['stats', 'me'],
    queryFn: async () => (await api.get<MyStats>('/stats/me')).data,
    enabled,
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
