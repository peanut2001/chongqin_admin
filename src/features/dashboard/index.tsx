import { Link } from '@tanstack/react-router'
import {
  CalendarDays,
  CircleCheck,
  ClipboardList,
  FolderHeart,
  GraduationCap,
  ScanEye,
  ChartNoAxesCombined,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { canAccess, canViewClassData } from '@/lib/permissions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { SimpleProgress } from '@/components/simple-progress'
import { cases, caseSystems } from '@/features/cases/data/cases'
import {
  semester,
  studentStats,
  weeklyActivity,
} from '@/features/learning-stats/data/stats'
import { questionSets } from '@/features/question-bank/data/questions'
import { Analytics } from './components/analytics'
import { Overview } from './components/overview'
import { RecentActivities } from './components/recent-activities'

const totalQuestions = questionSets.reduce((s, q) => s + q.total, 0)
const totalAiReads = weeklyActivity.reduce((s, w) => s + w.aiReads, 0)
const lastWeek = weeklyActivity[weeklyActivity.length - 1]
const prevWeek = weeklyActivity[weeklyActivity.length - 2]
const semesterPercent = Math.round(
  (semester.currentWeek / semester.totalWeeks) * 100
)

const kpis = [
  {
    title: '教学病例',
    value: `${cases.length} 例`,
    hint: `覆盖 ${caseSystems.length} 大系统`,
    icon: FolderHeart,
  },
  {
    title: '题库题量',
    value: totalQuestions.toLocaleString(),
    hint: `${questionSets.length} 个章节`,
    icon: ClipboardList,
  },
  {
    title: 'AI 判读次数',
    value: totalAiReads.toLocaleString(),
    hint: `本周 ${lastWeek.aiReads} 次，较上周 +${lastWeek.aiReads - prevWeek.aiReads}`,
    icon: ScanEye,
  },
  {
    title: '在学研究生',
    value: `${studentStats.length} 人`,
    hint: `本周平均正确率 ${lastWeek.accuracy}%`,
    icon: GraduationCap,
  },
]

const allModules = [
  {
    title: '病例库浏览',
    desc: '按系统 / 检查类型检索教学病例',
    url: '/cases',
    icon: FolderHeart,
  },
  {
    title: '题库练习',
    desc: '章节练习，即时判分与解析',
    url: '/question-bank',
    icon: ClipboardList,
  },
  {
    title: 'AI 图像判读',
    desc: '影像辅助判读与对照学习',
    url: '/ai-reading',
    icon: ScanEye,
  },
  {
    title: '学情统计',
    desc: '学习趋势、掌握度与学生明细',
    url: '/learning-stats',
    icon: ChartNoAxesCombined,
  },
] as const

export function Dashboard() {
  const role = useAuthStore((s) => s.auth.user?.role)
  // 只展示当前角色有权访问的功能模块
  const modules = allModules.filter((m) => canAccess(role, m.url))
  // 学生看不到「教学分析」和其他同学的「最近学习动态」
  const showClassData = canViewClassData(role)

  return (
    <>
      <DefaultHeader />

      <Main>
        <div className='mb-2 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>仪表盘</h1>
            <p className='text-muted-foreground'>
              {semester.course} · {semester.name}
            </p>
          </div>
        </div>

        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>概览</TabsTrigger>
              {showClassData && (
                <TabsTrigger value='analytics'>教学分析</TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value='overview' className='space-y-4'>
            {/* ===== KPI ===== */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {kpis.map((k) => (
                <Card key={k.title}>
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      {k.title}
                    </CardTitle>
                    <k.icon className='size-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>{k.value}</div>
                    <p className='text-xs text-muted-foreground'>{k.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ===== 课程运行 & 功能模块 ===== */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <CalendarDays className='size-5 text-primary' />
                    课程运行情况
                  </CardTitle>
                  <CardDescription>
                    {semester.startDate} 至 {semester.endDate}
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-sm'>
                      <span>
                        教学周 第 {semester.currentWeek} / {semester.totalWeeks}{' '}
                        周
                      </span>
                      <span className='text-muted-foreground'>
                        {semesterPercent}%
                      </span>
                    </div>
                    <SimpleProgress value={semesterPercent} />
                  </div>
                  <ul className='space-y-2 text-sm'>
                    {modules.map((m) => (
                      <li key={m.url} className='flex items-center gap-2'>
                        <CircleCheck className='size-4 text-emerald-600' />
                        {m.title}
                        <span className='ms-auto text-xs text-muted-foreground'>
                          已上线
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className='col-span-1 grid gap-4 sm:grid-cols-2 lg:col-span-4'>
                {modules.map((m) => (
                  <Link
                    key={m.url}
                    to={m.url}
                    className='group rounded-xl border bg-card p-5 transition hover:shadow-md'
                  >
                    <div className='mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                      <m.icon className='size-5' />
                    </div>
                    <h3 className='font-semibold group-hover:underline'>
                      {m.title}
                    </h3>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      {m.desc}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            {/* ===== 活跃度 & 动态 ===== */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card
                className={
                  showClassData
                    ? 'col-span-1 lg:col-span-4'
                    : 'col-span-1 lg:col-span-7'
                }
              >
                <CardHeader>
                  <CardTitle>学习活跃度</CardTitle>
                  <CardDescription>
                    各教学周病例浏览、题库练习与 AI 判读次数
                  </CardDescription>
                </CardHeader>
                <CardContent className='ps-2'>
                  <Overview />
                </CardContent>
              </Card>
              {showClassData && (
                <Card className='col-span-1 lg:col-span-3'>
                  <CardHeader>
                    <CardTitle>最近学习动态</CardTitle>
                    <CardDescription>研究生最新学习记录</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentActivities />
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {showClassData && (
            <TabsContent value='analytics' className='space-y-4'>
              <Analytics />
            </TabsContent>
          )}
        </Tabs>
      </Main>
    </>
  )
}
