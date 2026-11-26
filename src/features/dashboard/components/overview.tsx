import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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

/** 各教学周学习活跃度（堆叠柱状图） */
export function Overview({ data }: { data: WeeklyActivity[] }) {
  if (data.length === 0) {
    return (
      <div className='flex min-h-[350px] flex-1 items-center justify-center text-sm text-muted-foreground'>
        学期尚未开始
      </div>
    )
  }
  return (
    <ChartContainer
      config={chartConfig}
      className='aspect-auto min-h-[350px] w-full flex-1'
    >
      <BarChart data={data} margin={{ top: 8, left: -8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis
          dataKey='week'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label, payload) => {
                const total = payload.reduce(
                  (sum, p) => sum + (Number(p.value) || 0),
                  0
                )
                return `${label} · 合计 ${total.toLocaleString()}`
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        {series.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId='a'
            fill={`var(--color-${key})`}
            maxBarSize={44}
            radius={i === series.length - 1 ? [6, 6, 0, 0] : 0}
            animationDuration={900}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
