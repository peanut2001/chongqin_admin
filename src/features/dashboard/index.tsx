import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorTitle } from '@/lib/api/client'
import { canViewClassData } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { useDashboard, useMyStats } from '@/features/learning-stats/api'
import {
  AccuracyTrend,
  ActivityRings,
  ChapterMasteryRadar,
  StudyTimeGauge,
} from './components/dashboard-charts'
import { RecentActivities } from './components/recent-activities'
import { StatSection } from './components/stat-section'
import { WeeklySummary } from './components/weekly-summary'

function Panel({
  title,
  desc,
  link,
  className,
  children,
}: {
  title: string
  desc?: string
  /** 右上角跳转按钮 */
  link?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
        {link && (
          <CardAction>
            <Link
              to={link}
              aria-label={`查看${title}详情`}
              className='flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            >
              <ArrowUpRight className='size-4' />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className='flex-1'>{children}</CardContent>
    </Card>
  )
}

export function Dashboard() {
  const role = useAuthStore((s) => s.auth.user?.role)
  // 学生只看自己的数据，看不到「最近学习动态」等班级数据
  const showClassData = canViewClassData(role)
  const { data, isError, error } = useDashboard()
  // 学生的章节掌握度、模块时长不在 /dashboard 里，单独取 /stats/me
  const mine = useMyStats(!!role && !showClassData)
  const chapterMastery = showClassData
    ? data?.chapterMastery
    : mine.data?.chapterMastery
  const moduleUsage = showClassData ? data?.moduleUsage : mine.data?.moduleUsage
  const statsLink = showClassData ? '/learning-stats' : undefined

  return (
    <>
      <DefaultHeader />

      <Main>
        {!data && (
          <p className='text-muted-foreground'>
            {isError ? apiErrorTitle(error, '数据加载失败') : '加载中…'}
          </p>
        )}

        {data && (
          <div className='space-y-4'>
            <StatSection data={data} showStatsLink={showClassData} />

            <div className='grid gap-4 lg:grid-cols-12'>
              <Panel
                title={showClassData ? '本周学习' : '我的本周学习'}
                desc='病例浏览、练习题数与 AI 判读，及各教学周走势'
                className='lg:col-span-7'
              >
                <WeeklySummary data={data.weeklyActivity} />
              </Panel>
              <Panel
                title='学习时长分布'
                desc='本学期各功能模块累计学习时长'
                link={statsLink}
                className='lg:col-span-5'
              >
                <StudyTimeGauge data={moduleUsage ?? []} />
              </Panel>
            </div>

            <div
              className={cn(
                'grid gap-4 md:grid-cols-2',
                showClassData ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
              )}
            >
              <Panel title='章节掌握度' desc='按练习集统计的作答正确率'>
                <ChapterMasteryRadar data={chapterMastery ?? []} />
              </Panel>
              <Panel title='学习行为构成' desc='本学期各类学习次数占比'>
                <ActivityRings kpis={data.kpis} />
              </Panel>
              <Panel
                title='正确率走势'
                desc='各教学周平均正确率'
                link={statsLink}
              >
                <AccuracyTrend data={data.weeklyActivity} />
              </Panel>
              {showClassData && (
                <Panel title='最近学习动态' desc='研究生最新学习记录'>
                  <RecentActivities
                    items={data.recentActivities ?? []}
                    autoScroll
                    className='h-72'
                  />
                </Panel>
              )}
            </div>
          </div>
        )}
      </Main>
    </>
  )
}
