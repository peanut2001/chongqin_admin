import { useMemo, useState } from 'react'
import {
  Copy,
  Lightbulb,
  MessageSquareHeart,
  Sparkles,
  ThumbsUp,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorTitle } from '@/lib/api/client'
import {
  alpha,
  axisStyle,
  baseOption,
  tooltipHtml,
  tooltipStyle,
  useChartTheme,
} from '@/lib/echarts'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EChart } from '@/components/echart'
import { SimpleProgress } from '@/components/simple-progress'
import {
  formatRelativeTime,
  type StudentDetail,
  type WeeklyActivity,
  useStudentAdvice,
  useStudentDetail,
} from '../api'
import {
  AdviceError,
  AdviceFooter,
  AdviceLoading,
  AdviceSection,
  AiMark,
  BulletList,
  RefreshError,
} from './advice-ui'

/** 单个学生的学情详情与 AI 分析（右侧抽屉） */
export function StudentSheet({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  // 关闭动画期间继续显示刚才的学生，避免内容闪成「加载中」
  const [lastId, setLastId] = useState(userId)
  if (userId !== null && userId !== lastId) setLastId(userId)
  const id = userId ?? lastId

  const detail = useStudentDetail(id)
  const d = detail.data
  const s = d?.student

  return (
    <Sheet open={userId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className='w-full gap-0 sm:max-w-xl'>
        <SheetHeader className='border-b pe-12'>
          <SheetTitle className='flex items-center gap-2 text-lg'>
            {s ? s.name : <Skeleton className='h-6 w-24' />}
            {s?.needsAttention && <Badge variant='destructive'>需关注</Badge>}
          </SheetTitle>
          <SheetDescription>
            {s
              ? `${s.id} · ${s.className ?? '未分班'} · 最近学习 ${formatRelativeTime(s.lastActive)}`
              : '加载中…'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-6 overflow-y-auto p-4'>
          {detail.isError ? (
            <p className='text-sm text-destructive'>
              {apiErrorTitle(detail.error, '学情详情加载失败。')}
            </p>
          ) : !d ? (
            <div className='space-y-3'>
              <Skeleton className='h-20' />
              <Skeleton className='h-48' />
              <Skeleton className='h-32' />
            </div>
          ) : (
            <>
              <KpiCompare d={d} />
              <Block title='每周学习趋势' desc='柱：练习题数　线：正确率'>
                <WeeklyTrend weeks={d.weeklyActivity} />
              </Block>
              <Block
                title='章节掌握度'
                desc={`竖线为${d.peerLabel}，标红为明显低于${d.peerLabel}`}
              >
                <Chapters d={d} />
              </Block>
              <Block title='AI 判读自评' desc='学生对照 AI 结果后的自评'>
                <Agreement d={d} />
              </Block>
              {id && <StudentAdvicePanel userId={id} />}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Block({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-2'>
      <div className='flex items-baseline justify-between gap-2'>
        <h4 className='text-sm font-semibold'>{title}</h4>
        {desc && <span className='text-xs text-muted-foreground'>{desc}</span>}
      </div>
      {children}
    </section>
  )
}

/* ===================== 指标与对比基准 ===================== */

function KpiCompare({ d }: { d: StudentDetail }) {
  const s = d.student
  const items = [
    {
      label: '学习时长',
      value: s.studyHours,
      peer: d.peer.studyHours,
      unit: 'h',
    },
    {
      label: '练习题数',
      value: s.practiceCount,
      peer: d.peer.practiceCount,
      unit: '',
    },
    { label: '正确率', value: s.accuracy, peer: d.peer.accuracy, unit: '%' },
    { label: '病例浏览', value: s.caseViews, peer: d.peer.caseViews, unit: '' },
  ]
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
      {items.map((it) => {
        const diff =
          it.value !== null && it.peer !== null
            ? Math.round((it.value - it.peer) * 10) / 10
            : null
        return (
          <div key={it.label} className='rounded-lg border p-3'>
            <div className='text-xs text-muted-foreground'>{it.label}</div>
            <div className='mt-0.5 text-xl font-bold tabular-nums'>
              {it.value ?? '—'}
              <span className='ms-0.5 text-xs font-medium text-muted-foreground'>
                {it.value !== null && it.unit}
              </span>
            </div>
            <div
              className={cn(
                'text-xs tabular-nums',
                diff === null || diff === 0
                  ? 'text-muted-foreground'
                  : diff > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {diff === null
                ? `${d.peerLabel} ${it.peer ?? '—'}`
                : `比${d.peerLabel.replace('级平均', '均').replace('平均', '均')} ${diff > 0 ? '↑' : diff < 0 ? '↓' : ''}${Math.abs(diff)}${it.unit}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ===================== 每周趋势 ===================== */

function WeeklyTrend({ weeks }: { weeks: WeeklyActivity[] }) {
  const t = useChartTheme()
  const option = useMemo(() => {
    const ax = axisStyle(t)
    return {
      ...baseOption(t),
      grid: { left: 4, right: 4, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'axis',
        formatter: (ps: { dataIndex: number }[]) => {
          const w = weeks[ps[0].dataIndex]
          return tooltipHtml(w.week, [
            {
              color: t.series.practice,
              name: '练习题数',
              value: `${w.practice}`,
            },
            {
              color: t.primary,
              name: '正确率',
              value: w.accuracy === null ? '—' : `${w.accuracy}%`,
            },
            {
              color: t.series.cases,
              name: '病例浏览',
              value: `${w.caseViews}`,
            },
            { color: t.series.ai, name: 'AI 判读', value: `${w.aiReads}` },
          ])
        },
      },
      xAxis: {
        type: 'category',
        data: weeks.map((w) => w.weekIndex),
        ...ax,
        axisLabel: { ...ax.axisLabel, formatter: '{value}周' },
        splitLine: { show: false },
      },
      yAxis: [
        { type: 'value', minInterval: 1, ...ax },
        {
          type: 'value',
          min: 0,
          max: 100,
          ...ax,
          splitLine: { show: false },
          axisLabel: { ...ax.axisLabel, formatter: '{value}%' },
        },
      ],
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: {
            color: alpha(t.series.practice, 0.55),
            borderRadius: [4, 4, 0, 0],
          },
          data: weeks.map((w) => w.practice),
        },
        {
          type: 'line',
          yAxisIndex: 1,
          // 单调平滑，避免曲线越过 0% / 100%
          smooth: 0.3,
          smoothMonotone: 'x',
          connectNulls: true,
          symbolSize: 6,
          lineStyle: { width: 2, color: t.primary },
          itemStyle: { color: t.primary },
          data: weeks.map((w) => w.accuracy),
        },
      ],
    }
  }, [weeks, t])
  return <EChart option={option} height={190} />
}

/* ===================== 章节掌握度 ===================== */

function Chapters({ d }: { d: StudentDetail }) {
  if (d.chapterMastery.length === 0) {
    return <p className='text-sm text-muted-foreground'>暂无章节练习数据。</p>
  }
  return (
    <ul className='space-y-2.5'>
      {d.chapterMastery.map((c) => {
        const low =
          c.mastery !== null &&
          (c.mastery < 60 || c.mastery < c.peerMastery - 10)
        return (
          <li key={c.setId} className='flex items-center gap-3 text-sm'>
            <span className='w-20 shrink-0 truncate'>{c.chapter}</span>
            <div className='relative flex-1'>
              <SimpleProgress
                value={c.mastery ?? 0}
                indicatorClassName={low ? 'bg-destructive' : undefined}
              />
              <span
                className='absolute -top-1 h-4 w-0.5 rounded bg-foreground/60'
                style={{ left: `${c.peerMastery}%` }}
                title={`${d.peerLabel} ${c.peerMastery}%`}
              />
            </div>
            <span
              className={cn(
                'w-24 shrink-0 text-end text-xs tabular-nums',
                c.mastery === null
                  ? 'text-muted-foreground'
                  : low && 'font-medium text-destructive'
              )}
            >
              {c.mastery === null ? '未练习' : `${c.mastery}%`}
              <span className='ms-1 text-muted-foreground'>
                / {c.peerMastery}%
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* ===================== AI 判读自评 ===================== */

function Agreement({ d }: { d: StudentDetail }) {
  const items = [
    { key: '一致', color: 'bg-emerald-500' },
    { key: '部分一致', color: 'bg-amber-500' },
    { key: '不一致', color: 'bg-rose-500' },
    { key: '未自评', color: 'bg-muted-foreground/30' },
  ] as const
  const total = items.reduce((n, it) => n + d.aiAgreement[it.key], 0)
  if (total === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        本学期还没有 AI 判读记录。
      </p>
    )
  }
  return (
    <div className='space-y-2'>
      <div className='flex h-2 overflow-hidden rounded-full bg-muted'>
        {items.map((it) => (
          <div
            key={it.key}
            className={it.color}
            style={{ width: `${(d.aiAgreement[it.key] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
        <span>共 {total} 次</span>
        {items.map((it) => (
          <span key={it.key} className='flex items-center gap-1.5'>
            <span className={cn('size-2 rounded-full', it.color)} />
            {it.key} {d.aiAgreement[it.key]}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ===================== AI 分析 ===================== */

function StudentAdvicePanel({ userId }: { userId: string }) {
  const q = useStudentAdvice(userId)
  const a = q.data
  const generate = () => q.refetch()

  const copy = async () => {
    if (!a) return
    try {
      await navigator.clipboard.writeText(a.message)
      toast.success('已复制，可以直接发给学生')
    } catch {
      toast.error('复制失败，请手动选择文字复制')
    }
  }

  return (
    <section className='space-y-4 rounded-xl border bg-gradient-to-br from-violet-500/5 to-sky-500/5 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h4 className='flex items-center gap-2 font-semibold'>
          <AiMark className='size-6' />
          AI 学情分析
        </h4>
        {!a && !q.isFetching && !q.isError && (
          <Button size='sm' onClick={generate}>
            <Sparkles className='size-3.5' />
            生成分析
          </Button>
        )}
      </div>

      {a ? (
        <div
          className={cn(
            'space-y-4 transition-opacity',
            q.isFetching && 'opacity-50'
          )}
        >
          {q.isError && <RefreshError error={q.error} />}
          <p className='text-sm leading-relaxed'>{a.summary}</p>
          <AdviceSection icon={ThumbsUp} title='优势' tone='success'>
            <BulletList items={a.strengths} empty='暂未发现突出的优势。' />
          </AdviceSection>
          <AdviceSection icon={TriangleAlert} title='薄弱点' tone='warning'>
            <BulletList items={a.weaknesses} />
          </AdviceSection>
          <AdviceSection icon={Lightbulb} title='辅导建议'>
            <BulletList items={a.suggestions} ordered />
          </AdviceSection>
          {a.message && (
            <AdviceSection
              icon={MessageSquareHeart}
              title='给学生的话'
              tone='danger'
            >
              <div className='relative rounded-lg border bg-background p-3 pe-10 text-sm leading-relaxed'>
                {a.message}
                <Button
                  variant='ghost'
                  size='icon'
                  className='absolute end-1 top-1 size-7'
                  aria-label='复制给学生的话'
                  onClick={copy}
                >
                  <Copy className='size-3.5' />
                </Button>
              </div>
            </AdviceSection>
          )}
          <AdviceFooter
            isDemo={a.isDemo}
            disclaimer={a.disclaimer}
            generatedAt={a.generatedAt}
            refreshing={q.isFetching}
            onRefresh={generate}
          />
        </div>
      ) : q.isFetching ? (
        <AdviceLoading lines={5} />
      ) : q.isError ? (
        <AdviceError error={q.error} onRetry={generate} />
      ) : (
        <p className='text-sm text-muted-foreground'>
          结合该生的学习时长、练习表现、章节掌握度和 AI
          判读自评，生成优势、薄弱点、辅导建议，以及一段可以直接发给学生的学习建议。
        </p>
      )}
    </section>
  )
}
