import { Link } from '@tanstack/react-router'
import {
  ChartNoAxesCombined,
  BookOpenCheck,
  Clock,
  FolderHeart,
  GraduationCap,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import doctorCelebrate from '@/assets/images/doctor-celebrate.gif'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
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
  const sum = (w: WeeklyActivity) => w.caseViews + w.practice + w.aiReads

  // 病例浏览 / 练习 / AI 判读的次数在下方「本周学习」「学习行为构成」里已有，这里不再重复
  const resource: Kpi = {
    title: '教学资源',
    value: d.caseCount,
    unit: '例',
    icon: FolderHeart,
    hint: `题库 ${d.questionCount} 题 · ${d.questionSetCount} 个练习集`,
  }
  const accuracy: Kpi = {
    title: '平均正确率',
    value: d.kpis.avgAccuracy ?? 0,
    unit: '%',
    decimals: 1,
    icon: Target,
    trend:
      cur?.accuracy != null && prev?.accuracy != null
        ? { value: Math.round(cur.accuracy - prev.accuracy), unit: 'pt' }
        : null,
    hint: d.kpis.avgAccuracy === null ? '还没有作答记录' : undefined,
  }
  const hours: Kpi = {
    title: personal ? '我的学习时长' : '人均学习时长',
    value: d.kpis.avgStudyHours,
    unit: '小时',
    decimals: 1,
    icon: Clock,
    hint: '本学期累计',
  }
  const people: Kpi = personal
    ? {
        title: '本周学习',
        value: cur ? sum(cur) : 0,
        unit: '次',
        icon: BookOpenCheck,
        trend: cur && prev ? weekChange(sum(cur), sum(prev)) : null,
        hint: '病例、练习与判读合计',
      }
    : {
        title: '在学研究生',
        value: d.studentCount,
        unit: '人',
        icon: GraduationCap,
        hint:
          d.kpis.needsAttention > 0
            ? `${d.kpis.needsAttention} 人学习时长偏低`
            : '全部达到学习时长要求',
      }
  return [resource, people, hours, accuracy]
}

function timeGreeting(hour: number) {
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 问候下方的一句话：按角色和真实数据给出提示 */
function greetingLine(d: Dashboard) {
  const { currentWeek, totalWeeks } = d.semester
  const weekText = `本学期第 ${currentWeek} 周`
  if (d.scope === 'personal') {
    const cur = d.weeklyActivity[d.weeklyActivity.length - 1]
    const count = cur ? cur.caseViews + cur.practice + cur.aiReads : 0
    if (currentWeek >= totalWeeks)
      return `${weekText}，学期收尾啦，记得查漏补缺～`
    return count > 0
      ? `${weekText}，这周已经学习 ${count} 次，继续保持！`
      : `${weekText}，今天也来看几个病例吧～`
  }
  return d.kpis.needsAttention > 0
    ? `${weekText}，有 ${d.kpis.needsAttention} 名研究生学习时长偏低，记得关注一下。`
    : `${weekText}，研究生们的学习进度都不错，来看看本周情况吧。`
}

function TrendBadge({ trend }: { trend: Trend }) {
  const up = trend.value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  const text =
    trend.unit === '%'
      ? `${up ? '+' : ''}${trend.value}%`
      : `${up ? '+' : ''}${trend.value} 个点`
  return (
    <div className='flex items-center gap-1.5'>
      <span
        className={cn(
          'inline-flex items-center gap-1 font-medium',
          up
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400'
        )}
      >
        <Icon className='size-3' />
        {text}
      </span>
      <span>较上周</span>
    </div>
  )
}

function KpiTile({ kpi, index }: { kpi: Kpi; index: number }) {
  return (
    <div
      className='flex animate-in flex-col gap-2 fill-mode-both fade-in slide-in-from-bottom-2 xl:px-6 xl:first:ps-0 xl:last:pe-0 xl:[&:not(:first-child)]:border-s'
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <kpi.icon className='size-4' />
        {kpi.title}
      </div>
      <div className='text-3xl font-bold tracking-tight'>
        <NumberTicker value={kpi.value} decimals={kpi.decimals} />
        {kpi.unit && (
          <span className='ms-1 text-sm font-medium text-muted-foreground'>
            {kpi.unit}
          </span>
        )}
      </div>
      <div className='min-h-5 text-xs text-muted-foreground'>
        {kpi.trend ? <TrendBadge trend={kpi.trend} /> : kpi.hint}
      </div>
    </div>
  )
}

/** 顶部「学习统计」：学期进度 + 4 个指标（同一卡片内用分隔线分开） */
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
  const name = useAuthStore((s) => s.auth.user?.name)
  return (
    <section className='rounded-xl border bg-card p-5 shadow-sm sm:p-6'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
        <div className='flex min-w-0 items-center gap-3'>
          {/* 装饰：打招呼的小医生。GIF 透明底、左侧自带约 1/3 高度的留白，用负边距贴齐卡片内边距；
              高度与右侧两行文字一致 */}
          <img
            src={doctorCelebrate}
            alt=''
            aria-hidden
            draggable={false}
            className='pointer-events-none -ms-5 h-16 w-auto shrink-0 select-none'
          />
          <div className='min-w-0 space-y-1'>
            <h2 className='text-xl font-semibold tracking-tight sm:text-2xl'>
              {timeGreeting(new Date().getHours())}
              {name ? `，${name}` : ''} 👋
            </h2>
            <p className='text-sm text-muted-foreground'>
              {greetingLine(data)}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          {/* 学期信息归在一起：周次、进度、起止日期 */}
          <div className='w-48 space-y-1.5'>
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>
                第 {semester.currentWeek} / {semester.totalWeeks} 周
              </span>
              <span>{percent}%</span>
            </div>
            <SimpleProgress value={percent} className='h-1.5' />
            <p className='text-xs text-muted-foreground/80'>
              {semester.startDate} 至 {semester.endDate}
            </p>
          </div>
          {showStatsLink && (
            <Link
              to='/learning-stats'
              className='group relative inline-flex items-center overflow-hidden rounded-xl bg-primary/10 py-2.5 ps-10 pe-4 text-sm font-medium text-primary shadow-[0_10px_10px_-10px_rgba(33,35,38,0.1)] transition-[background-color,transform] outline-none hover:bg-primary/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]'
            >
              {/* 悬停时图标带回弹地往右挪一点 */}
              <ChartNoAxesCombined className='absolute start-3 size-5 transition-transform duration-400 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)] group-hover:translate-x-1 group-hover:scale-110' />
              学情统计
            </Link>
          )}
        </div>
      </div>
      <div className='grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-0'>
        {kpis.map((k, i) => (
          <KpiTile key={k.title} kpi={k} index={i} />
        ))}
      </div>
    </section>
  )
}
