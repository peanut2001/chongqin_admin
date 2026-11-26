import { ClipboardList, FolderHeart, ScanEye } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { type WeeklyActivity } from '@/features/learning-stats/api'

const chartConfig = {
  caseViews: { label: '病例浏览', color: 'var(--chart-1)' },
  practice: { label: '练习题数', color: 'var(--chart-2)' },
  aiReads: { label: 'AI 判读', color: 'var(--chart-3)' },
} satisfies ChartConfig

const series = Object.keys(chartConfig) as (keyof typeof chartConfig)[]

const icons = {
  caseViews: FolderHeart,
  practice: ClipboardList,
  aiReads: ScanEye,
}

const total = (w: WeeklyActivity) => w.caseViews + w.practice + w.aiReads

/** 「本周学习」：本周总量与环比、三类学习次数、各周趋势 */
export function WeeklySummary({ data }: { data: WeeklyActivity[] }) {
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
    <div className='flex h-full flex-col gap-4'>
      <div className='flex flex-wrap items-stretch gap-3'>
        <div className='flex min-w-28 flex-col justify-center'>
          <div className='text-3xl font-bold tracking-tight'>
            {total(cur).toLocaleString()}
          </div>
          <div className='text-xs text-muted-foreground'>
            {cur.week}学习次数
            {change !== null && (
              <span
                className={cn(
                  'ms-1 font-medium',
                  change >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {change >= 0 ? '+' : ''}
                {change}%
              </span>
            )}
          </div>
        </div>
        {series.map((key) => {
          const Icon = icons[key]
          const color = chartConfig[key].color
          return (
            <div
              key={key}
              className='flex min-w-24 flex-1 flex-col items-center gap-1.5 rounded-xl border bg-card px-3 py-3'
            >
              <div
                className='flex size-8 items-center justify-center rounded-full'
                style={{
                  background: `color-mix(in oklch, ${color} 15%, transparent)`,
                  color,
                }}
              >
                <Icon className='size-4' />
              </div>
              <span className='text-xs text-muted-foreground'>
                {chartConfig[key].label}
              </span>
              <span className='text-base font-semibold' style={{ color }}>
                {cur[key].toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      <ChartContainer
        config={chartConfig}
        className='aspect-auto min-h-48 w-full flex-1'
      >
        <AreaChart data={data} margin={{ top: 4, left: -16, right: 4 }}>
          <defs>
            {series.map((key) => (
              <linearGradient
                key={key}
                id={`area-${key}`}
                x1='0'
                y1='0'
                x2='0'
                y2='1'
              >
                <stop
                  offset='5%'
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0.5}
                />
                <stop
                  offset='95%'
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0.05}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='week'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            fontSize={11}
          />
          <ChartTooltip content={<ChartTooltipContent indicator='line' />} />
          {series.map((key) => (
            <Area
              key={key}
              dataKey={key}
              type='monotone'
              stackId='a'
              stroke={`var(--color-${key})`}
              strokeWidth={2}
              fill={`url(#area-${key})`}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
