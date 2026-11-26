import { useMemo } from 'react'
import {
  alpha,
  axisStyle,
  baseOption,
  echarts,
  tooltipHtml,
  tooltipStyle,
  useChartTheme,
  type ChartTheme,
} from '@/lib/echarts'
import { cn } from '@/lib/utils'
import { DonutChart, EChart, type DonutItem } from '@/components/echart'
import { SimpleProgress } from '@/components/simple-progress'
import {
  type ChapterMastery,
  type Kpis,
  type ModuleUsage,
  type WeeklyActivity,
} from '@/features/learning-stats/api'

/** 掌握度低于该值的章节高亮显示 */
const WEAK_MASTERY = 60

function moduleColor(t: ChartTheme, key: string) {
  return t.series[key as keyof ChartTheme['series']] ?? t.primary
}

function Empty({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground',
        className
      )}
    >
      {text}
    </div>
  )
}

/** 学习时长分布：半环图 + 下方各模块时长 */
export function StudyTimeGauge({ data }: { data: ModuleUsage[] }) {
  const t = useChartTheme()
  const items: DonutItem[] = useMemo(
    () =>
      data.map((d) => ({
        key: d.key,
        name: d.name,
        value: d.value,
        color: moduleColor(t, d.key),
      })),
    [data, t]
  )
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <Empty text='暂无学习记录' />

  return (
    <div className='flex h-full flex-col justify-between gap-5'>
      <DonutChart
        items={items}
        variant='half'
        totalLabel='累计学习时长（小时）'
        format={(v) => `${v}`}
        className='mx-auto max-w-md'
      />
      <ul className='divide-y text-sm'>
        {items.map((d) => (
          <li key={d.key} className='flex items-center gap-2 py-2.5'>
            <span
              className='size-2.5 shrink-0 rounded-full'
              style={{ background: d.color }}
            />
            <span className='text-muted-foreground'>{d.name}</span>
            <span className='ms-auto font-semibold tabular-nums'>
              {d.value}
              <span className='ms-0.5 text-xs font-normal text-muted-foreground'>
                小时
              </span>
            </span>
            <span className='w-10 text-end text-xs text-muted-foreground tabular-nums'>
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Ring = { key: string; name: string; value: number; color: string }

/** 学习行为构成：同心进度环（每环 = 该类占本学期学习次数的比例），依次画出 */
export function ActivityRings({ kpis }: { kpis: Kpis }) {
  const t = useChartTheme()
  const items: Ring[] = useMemo(
    () => [
      {
        key: 'cases',
        name: '病例浏览',
        value: kpis.totalCaseViews,
        color: t.series.cases,
      },
      {
        key: 'practice',
        name: '练习题数',
        value: kpis.totalPractice,
        color: t.series.practice,
      },
      {
        key: 'ai',
        name: 'AI 判读',
        value: kpis.totalAiReads,
        color: t.series.ai,
      },
    ],
    [kpis, t]
  )
  const total = items.reduce((s, d) => s + d.value, 0)

  const option = useMemo(() => {
    const pct = (v: number) => (total ? Math.round((v / total) * 1000) / 10 : 0)
    // 第一项在最外圈，与下方列表顺序一致
    const rings = [...items].reverse()
    return {
      ...baseOption(t),
      animationDuration: 1400,
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const d = rings[p.dataIndex]
          return tooltipHtml(d.name, [
            { color: d.color, name: '次数', value: d.value.toLocaleString() },
            { color: d.color, name: '占比', value: `${pct(d.value)}%` },
          ])
        },
      },
      polar: { radius: ['38%', '96%'] },
      angleAxis: { max: 100, startAngle: 90, show: false },
      radiusAxis: {
        type: 'category',
        data: rings.map((r) => r.name),
        show: false,
      },
      series: [
        {
          type: 'bar',
          coordinateSystem: 'polar',
          roundCap: true,
          barCategoryGap: '32%',
          showBackground: true,
          backgroundStyle: { color: t.muted },
          animationDelay: (i: number) => i * 250,
          data: rings.map((r) => ({
            value: pct(r.value),
            itemStyle: { color: r.color },
          })),
        },
      ],
    }
  }, [items, total, t])

  if (total === 0) return <Empty text='暂无学习记录' />
  return (
    <div className='flex h-full flex-col gap-4'>
      <div className='relative mx-auto aspect-square w-full max-w-56'>
        <EChart option={option} height='100%' />
        <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
          <span className='text-[11px] text-muted-foreground'>学习次数</span>
          <span className='text-xl font-bold tabular-nums'>
            {total.toLocaleString()}
          </span>
        </div>
      </div>
      <ul className='space-y-2.5 text-xs'>
        {items.map((it) => (
          <li key={it.key} className='flex items-center gap-2'>
            <span
              className='size-2.5 shrink-0 rounded-full'
              style={{ background: it.color }}
            />
            <span className='text-muted-foreground'>{it.name}</span>
            <span className='ms-auto font-medium tabular-nums'>
              {it.value.toLocaleString()}
            </span>
            <span className='w-11 text-end text-muted-foreground tabular-nums'>
              {Math.round((it.value / total) * 1000) / 10}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 各周平均正确率走势；本周数据点带持续的涟漪动效 */
export function AccuracyTrend({ data }: { data: WeeklyActivity[] }) {
  const t = useChartTheme()
  const option = useMemo(() => {
    const weeks = data.map((w) => w.week)
    const values = data.map((w) => w.accuracy)
    const known = values.filter((v): v is number => v !== null)
    const last = data.length - 1
    const lastValue = values[last] as number | null | undefined
    const color = t.series.practice
    // 折线不必从 0 开始；留出上下余量，让波动看得出来
    const min = known.length
      ? Math.max(0, Math.floor((Math.min(...known) - 10) / 10) * 10)
      : 0
    return {
      ...baseOption(t),
      animationDuration: 1600,
      grid: { left: 4, right: 16, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: t.mutedForeground, type: [4, 4] },
        },
        formatter: (ps: { name: string; value: number | null }[]) =>
          tooltipHtml(ps[0].name, [
            {
              color,
              name: '平均正确率',
              value: ps[0].value == null ? '—' : `${ps[0].value}%`,
            },
          ]),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: weeks,
        ...axisStyle(t),
        axisLabel: {
          ...axisStyle(t).axisLabel,
          formatter: (v: string) => v.replace(/[第周]/g, ''),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min,
        max: 100,
        splitNumber: 3,
        ...axisStyle(t),
        axisLabel: { ...axisStyle(t).axisLabel, formatter: '{value}%' },
      },
      series: [
        {
          type: 'line',
          smooth: 0.4,
          connectNulls: true,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          lineStyle: { width: 2.5, color },
          itemStyle: { color, borderColor: t.card, borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: alpha(color, 0.3) },
              { offset: 1, color: alpha(color, 0) },
            ]),
          },
          data: values,
        },
        ...(lastValue != null
          ? [
              {
                type: 'effectScatter',
                silent: true,
                symbolSize: 9,
                rippleEffect: { scale: 3.2, brushType: 'stroke', period: 3 },
                itemStyle: { color },
                label: {
                  show: true,
                  position: 'top',
                  distance: 10,
                  formatter: `${lastValue}%`,
                  color: t.card,
                  backgroundColor: t.foreground,
                  padding: [3, 6],
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                },
                data: [[weeks[last], lastValue]],
                z: 3,
              },
            ]
          : []),
      ],
    }
  }, [data, t])

  const cur = data[data.length - 1] as WeeklyActivity | undefined
  if (!cur || data.every((w) => w.accuracy === null)) {
    return <Empty text='暂无作答数据' />
  }
  return (
    <div className='flex h-full flex-col gap-3'>
      <div className='flex items-baseline gap-2'>
        <span className='text-3xl font-bold tracking-tight'>
          {cur.accuracy ?? '—'}
          {cur.accuracy !== null && <span className='text-lg'>%</span>}
        </span>
        <span className='text-xs text-muted-foreground'>
          {cur.week}平均正确率
        </span>
      </div>
      <EChart option={option} height={240} />
    </div>
  )
}

/** 章节掌握度：雷达图（低于 60% 的章节标红）；不足 3 个章节时用进度条 */
export function ChapterMasteryRadar({ data }: { data: ChapterMastery[] }) {
  const t = useChartTheme()
  const option = useMemo(() => {
    const color = t.series.practice
    const byName = new Map(data.map((c) => [c.chapter, c.mastery]))
    return {
      ...baseOption(t),
      animationDuration: 1400,
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'item',
        formatter: () =>
          tooltipHtml(
            '章节掌握度',
            data.map((c) => ({
              color: c.mastery < WEAK_MASTERY ? t.destructive : color,
              name: c.chapter,
              value: `${c.mastery}%`,
            }))
          ),
      },
      radar: {
        center: ['50%', '54%'],
        radius: '64%',
        splitNumber: 4,
        shape: 'polygon',
        indicator: data.map((c) => ({ name: c.chapter, max: 100 })),
        axisName: {
          formatter: (name: string) => {
            const v = byName.get(name) ?? 0
            return `{n|${name}}\n{${v < WEAK_MASTERY ? 'w' : 'v'}|${v}%}`
          },
          rich: {
            n: { color: t.mutedForeground, fontSize: 11, lineHeight: 16 },
            v: { color: t.foreground, fontSize: 12, fontWeight: 600 },
            w: { color: t.destructive, fontSize: 12, fontWeight: 600 },
          },
        },
        axisLine: { lineStyle: { color: t.border } },
        splitLine: { lineStyle: { color: t.border } },
        splitArea: {
          areaStyle: { color: [alpha(t.muted, 0.5), 'transparent'] },
        },
      },
      series: [
        {
          type: 'radar',
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color },
          itemStyle: { color, borderColor: t.card, borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
              { offset: 0, color: alpha(color, 0.08) },
              { offset: 1, color: alpha(color, 0.4) },
            ]),
          },
          emphasis: { lineStyle: { width: 3 } },
          data: [{ name: '掌握度', value: data.map((c) => c.mastery) }],
        },
      ],
    }
  }, [data, t])

  if (data.length === 0) return <Empty text='暂无作答数据' />
  if (data.length < 3) return <ChapterMasteryList data={data} />
  return <EChart option={option} height={300} />
}

function ChapterMasteryList({ data }: { data: ChapterMastery[] }) {
  return (
    <ul className='space-y-4'>
      {data.map((c) => {
        const weak = c.mastery < WEAK_MASTERY
        return (
          <li key={c.setId} className='space-y-1.5'>
            <div className='flex items-center justify-between text-sm'>
              <span className='font-medium'>{c.chapter}</span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  weak
                    ? 'font-medium text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground'
                )}
              >
                {c.mastery}%
              </span>
            </div>
            <SimpleProgress
              value={c.mastery}
              indicatorClassName={weak ? 'bg-rose-500' : 'bg-primary'}
            />
          </li>
        )
      })}
    </ul>
  )
}
