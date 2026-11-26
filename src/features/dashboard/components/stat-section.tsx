import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  Clock,
  FolderHeart,
  GraduationCap,
  ScanEye,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NumberTicker } from '@/components/number-ticker'
import { SimpleProgress } from '@/components/simple-progress'
import {
  type Dashboard,
  type WeeklyActivity,
} from '@/features/learning-stats/api'

type Trend = { value: number; unit: '%' | 'pt' }

type Kpi = {
  title: string
  value: number
  unit?: string
  decimals?: number
  icon: LucideIcon
  /** 与上周对比；没有可比数据时显示 hint */
  trend?: Trend | null
  hint?: string
}

/** 本周相对上周的变化率；上周为 0 时无法计算 */
function weekChange(cur: number, prev: number): Trend | null {
  if (prev === 0) return null
  return { value: Math.round(((cur - prev) / prev) * 100), unit: '%' }
}

function buildKpis(d: Dashboard): Kpi[] {
  const weeks = d.weeklyActivity
  const cur = weeks[weeks.length - 1] as WeeklyActivity | undefined
  const prev = weeks[weeks.length - 2] as WeeklyActivity | undefined
  const personal = d.scope === 'personal'
  const trendOf = (key: 'caseViews' | 'practice' | 'aiReads') =>
    cur && prev ? weekChange(cur[key], prev[key]) : null
  const accuracyTrend: Trend | null =
    cur?.accuracy != null && prev?.accuracy != null
      ? { value: Math.round(cur.accuracy - prev.accuracy), unit: 'pt' }
      : null

  const resource: Kpi[] = [
    {
      title: '教学病例',
      value: d.caseCount,
      unit: '例',
      icon: FolderHeart,
      hint: `覆盖 ${d.systemCount} 大系统`,
    },
    {
      title: '题库题量',
      value: d.questionCount,
      unit: '题',
      icon: ClipboardList,
      hint: `${d.questionSetCount} 个练习集`,
    },
  ]
  const people: Kpi[] = personal
    ? [
        {
          title: '本周学习',
          value: cur ? cur.caseViews + cur.practice + cur.aiReads : 0,
          unit: '次',
          icon: BookOpenCheck,
          trend:
            cur && prev
              ? weekChange(
                  cur.caseViews + cur.practice + cur.aiReads,
                  prev.caseViews + prev.practice + prev.aiReads
                )
              : null,
          hint: '病例、练习与判读合计',
        },
        {
          title: '我的学习时长',
          value: d.kpis.avgStudyHours,
          unit: '小时',
          decimals: 1,
          icon: Clock,
          hint: '本学期累计',
        },
      ]
    : [
        {
          title: '在学研究生',
          value: d.studentCount,
          unit: '人',
          icon: GraduationCap,
          hint:
            d.kpis.needsAttention > 0
              ? `${d.kpis.needsAttention} 人学习时长偏低`
              : '全部达到学习时长要求',
        },
        {
          title: '人均学习时长',
          value: d.kpis.avgStudyHours,
          unit: '小时',
          decimals: 1,
          icon: Clock,
          hint: '本学期累计',
        },
      ]
  const activity: Kpi[] = [
    {
      title: personal ? '我的病例浏览' : '病例浏览',
      value: d.kpis.totalCaseViews,
      unit: '次',
      icon: FolderHeart,
      trend: trendOf('caseViews'),
    },
    {
      title: personal ? '我的练习' : '练习题数',
      value: d.kpis.totalPractice,
      unit: '题',
      icon: ClipboardList,
      trend: trendOf('practice'),
    },
    {
      title: personal ? '我的 AI 判读' : 'AI 判读',
      value: d.kpis.totalAiReads,
      unit: '次',
      icon: ScanEye,
      trend: trendOf('aiReads'),
    },
    {
      title: '平均正确率',
      value: d.kpis.avgAccuracy ?? 0,
      unit: '%',
      decimals: 1,
      icon: Target,
      trend: accuracyTrend,
      hint: d.kpis.avgAccuracy === null ? '还没有作答记录' : undefined,
    },
  ]
  return [...resource, ...people, ...activity]
}

function TrendBadge({ trend }: { trend: Trend }) {
  const up = trend.value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  const text =
    trend.unit === '%'
      ? `${up ? '+' : ''}${trend.value}%`
      : `${up ? '+' : ''}${trend.value} 个点`
  return (
    <div className='flex flex-col items-end gap-0.5'>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
          up
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        )}
      >
        <Icon className='size-3' />
        {text}
      </span>
      <span className='text-[11px] text-muted-foreground'>较上周</span>
    </div>
  )
}

function KpiTile({ kpi, index }: { kpi: Kpi; index: number }) {
  return (
    <div
      className='flex animate-in flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow duration-500 fill-mode-both fade-in slide-in-from-bottom-2 hover:shadow-md'
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className='flex items-center gap-2'>
        <div className='flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary'>
          <kpi.icon className='size-4' />
        </div>
        <span className='text-sm font-medium'>{kpi.title}</span>
      </div>
      <div className='flex items-end justify-between gap-2'>
        <div className='text-2xl font-bold tracking-tight'>
          <NumberTicker value={kpi.value} decimals={kpi.decimals} />
          {kpi.unit && (
            <span className='ms-1 text-sm font-medium text-muted-foreground'>
              {kpi.unit}
            </span>
          )}
        </div>
        {kpi.trend ? (
          <TrendBadge trend={kpi.trend} />
        ) : (
          kpi.hint && (
            <span className='text-end text-xs text-muted-foreground'>
              {kpi.hint}
            </span>
          )
        )}
      </div>
    </div>
  )
}

/** 顶部「学习统计」：学期进度 + 8 个指标卡 */
export function StatSection({
  data,
  showStatsLink,
}: {
  data: Dashboard
  showStatsLink: boolean
}) {
  const { semester } = data
  const percent = Math.round((semester.currentWeek / semester.totalWeeks) * 100)
  const kpis = buildKpis(data)
  return (
    <section className='rounded-2xl border bg-muted/30 p-4 sm:p-5'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>学习统计</h2>
          <p className='text-sm text-muted-foreground'>
            {semester.startDate} 至 {semester.endDate}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <div className='w-44 space-y-1'>
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>
                第 {semester.currentWeek} / {semester.totalWeeks} 周
              </span>
              <span>{percent}%</span>
            </div>
            <SimpleProgress value={percent} className='h-1.5' />
          </div>
          {showStatsLink && (
            <Button asChild size='sm'>
              <Link to='/learning-stats'>
                学情统计
                <ArrowRight className='size-4' />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {kpis.map((k, i) => (
          <KpiTile key={k.title} kpi={k} index={i} />
        ))}
      </div>
    </section>
  )
}
