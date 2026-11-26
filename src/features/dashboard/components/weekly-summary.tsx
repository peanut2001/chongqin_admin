import { useMemo } from 'react'
import {
  alpha,
  axisStyle,
  baseOption,
  echarts,
  tooltipHtml,
  tooltipStyle,
  useChartTheme,
} from '@/lib/echarts'
import { cn } from '@/lib/utils'
import { EChart } from '@/components/echart'
import { type WeeklyActivity } from '@/features/learning-stats/api'

const series = [
  { key: 'caseViews', entity: 'cases', label: '病例浏览' },
  {
    key: 'practice',
    entity: 'practice',
    label: '练习题数',
  },
  { key: 'aiReads', entity: 'ai', label: 'AI 判读' },
] as const

const total = (w: WeeklyActivity) => w.caseViews + w.practice + w.aiReads

/** 「本周学习」：本周总量与环比、三类学习次数、各周趋势 */
export function WeeklySummary({ data }: { data: WeeklyActivity[] }) {
  const t = useChartTheme()

  const option = useMemo(
    () => ({
      ...baseOption(t),
      color: series.map((s) => t.series[s.entity]),
      grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: t.mutedForeground, type: [4, 4], width: 1 },
        },
        formatter: (
          ps: {
            name: string
            seriesName: string
            value: number
            color: string
          }[]
        ) => {
          const sum = ps.reduce((s, p) => s + (p.value || 0), 0)
          return tooltipHtml(
            `${ps[0].name} · 合计 ${sum.toLocaleString()}`,
            [...ps].reverse().map((p) => ({
              color: p.color,
              name: p.seriesName,
              value: (p.value ?? 0).toLocaleString(),
            }))
          )
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map((w) => w.week),
        ...axisStyle(t),
        splitLine: { show: false },
      },
      yAxis: { type: 'value', splitNumber: 4, ...axisStyle(t) },
      series: series.map((s) => {
        const color = t.series[s.entity]
        return {
          name: s.label,
          type: 'line',
          stack: 'total',
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: false,
          lineStyle: { width: 2, color },
          itemStyle: { color, borderColor: t.card, borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: alpha(color, 0.32) },
              { offset: 1, color: alpha(color, 0.04) },
            ]),
          },
          emphasis: { focus: 'series' },
          data: data.map((w) => w[s.key]),
        }
      }),
    }),
    [data, t]
  )

  const cur = data[data.length - 1] as WeeklyActivity | undefined
  const prev = data[data.length - 2] as WeeklyActivity | undefined
  if (!cur) {
    return (
      <div className='flex h-full min-h-60 items-center justify-center text-sm text-muted-foreground'>
        学期尚未开始
      </div>
    )
  }
  const change =
    prev && total(prev) > 0
      ? Math.round(((total(cur) - total(prev)) / total(prev)) * 100)
      : null

  return (
    <div className='flex h-full flex-col gap-5'>
      {/* 本周合计 + 三类次数：四列等宽铺满，分隔线隔开；色点兼作图例 */}
      <div className='grid grid-cols-2 gap-y-4 border-y py-4 sm:grid-cols-4 sm:divide-x'>
        <div className='px-4 first:ps-0'>
          <div className='text-xs text-muted-foreground'>
            {cur.week}学习次数
          </div>
          <div className='mt-1 text-2xl font-bold tracking-tight tabular-nums'>
            {total(cur).toLocaleString()}
          </div>
          {change !== null && (
            <div
              className={cn(
                'mt-0.5 text-xs font-medium',
                change >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {change >= 0 ? '+' : ''}
              {change}% 较上周
            </div>
          )}
        </div>
        {series.map((s) => (
          <div key={s.key} className='px-4 sm:ps-6'>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <span
                className='size-2 rounded-full'
                style={{ background: t.series[s.entity] }}
              />
              {s.label}
            </div>
            <div className='mt-1 text-2xl font-bold tracking-tight tabular-nums'>
              {cur[s.key].toLocaleString()}
            </div>
            <div className='mt-0.5 text-xs text-muted-foreground'>
              占本周{' '}
              {total(cur) ? Math.round((cur[s.key] / total(cur)) * 100) : 0}%
            </div>
          </div>
        ))}
      </div>

      <EChart option={option} height={260} />
    </div>
  )
}
