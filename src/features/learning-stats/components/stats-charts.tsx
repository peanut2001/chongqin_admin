import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  type ChapterMastery,
  type ModuleUsage,
  type WeeklyActivity,
} from '../api'

const axisProps = { tickLine: false, axisLine: false } as const

const moduleColors: Record<string, string> = {
  cases: 'var(--chart-1)',
  practice: 'var(--chart-2)',
  ai: 'var(--chart-3)',
}

/** 掌握度低于该值的章节高亮显示 */
const WEAK_MASTERY = 60

function Empty({ height, text }: { height: number; text: string }) {
  return (
    <div
      className='flex items-center justify-center text-sm text-muted-foreground'
      style={{ height }}
    >
      {text}
    </div>
  )
}

const trendConfig = {
  practice: { label: '练习题数', color: 'var(--chart-2)' },
  aiReads: { label: 'AI 判读次数', color: 'var(--chart-3)' },
  accuracy: { label: '平均正确率(%)', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** 每周练习题数、AI 判读次数 + 平均正确率 */
export function WeeklyTrendChart({
  data,
  height = 320,
}: {
  data: WeeklyActivity[]
  height?: number
}) {
  if (data.length === 0) return <Empty height={height} text='学期尚未开始' />
  return (
    <ChartContainer
      config={trendConfig}
      className='aspect-auto w-full'
      style={{ height }}
    >
      <ComposedChart data={data} margin={{ top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis dataKey='week' tickMargin={8} {...axisProps} />
        <YAxis yAxisId='left' allowDecimals={false} {...axisProps} />
        <YAxis
          yAxisId='right'
          orientation='right'
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          {...axisProps}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        <Bar
          yAxisId='left'
          dataKey='practice'
          fill='var(--color-practice)'
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          yAxisId='left'
          dataKey='aiReads'
          fill='var(--color-aiReads)'
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Line
          yAxisId='right'
          type='monotone'
          dataKey='accuracy'
          stroke='var(--color-accuracy)'
          strokeWidth={2.5}
          dot={{ r: 3, fill: 'var(--color-accuracy)' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  )
}

const masteryConfig = {
  mastery: { label: '掌握度(%)', color: 'var(--chart-2)' },
} satisfies ChartConfig

/** 各章节掌握度（作答正确率），胶囊条形 + 右侧数值 */
export function ChapterMasteryChart({
  data,
  height = 260,
}: {
  data: ChapterMastery[]
  height?: number
}) {
  if (data.length === 0) return <Empty height={height} text='暂无作答数据' />
  const rows = data.map((d) => ({
    ...d,
    fill: d.mastery < WEAK_MASTERY ? 'var(--chart-5)' : 'var(--color-mastery)',
  }))
  return (
    <ChartContainer
      config={masteryConfig}
      className='aspect-auto w-full'
      style={{ height }}
    >
      <BarChart data={rows} layout='vertical' margin={{ left: 4, right: 4 }}>
        <XAxis type='number' domain={[0, 100]} hide />
        <YAxis
          yAxisId='name'
          type='category'
          dataKey='chapter'
          width={72}
          {...axisProps}
        />
        <YAxis
          yAxisId='value'
          type='category'
          dataKey='chapter'
          orientation='right'
          width={40}
          tickFormatter={(_, i) => `${rows[i]?.mastery ?? ''}%`}
          {...axisProps}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar
          yAxisId='name'
          dataKey='mastery'
          radius={999}
          barSize={14}
          background={{ fill: 'var(--muted)', radius: 999 }}
        />
      </BarChart>
    </ChartContainer>
  )
}

/** 功能模块学习时长占比（环图 + 中心合计） */
export function ModuleUsageChart({
  data,
  height = 260,
}: {
  data: ModuleUsage[]
  height?: number
}) {
  if (data.every((d) => d.value === 0)) {
    return <Empty height={height} text='暂无学习记录' />
  }
  const config = Object.fromEntries(
    data.map((d) => [
      d.key,
      { label: d.name, color: moduleColors[d.key] ?? 'var(--chart-4)' },
    ])
  ) satisfies ChartConfig
  const rows = data.map((d) => ({ ...d, fill: `var(--color-${d.key})` }))
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <ChartContainer
      config={config}
      className='aspect-auto w-full'
      style={{ height }}
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey='key'
              hideLabel
              formatter={(value, _name, item) => (
                <div className='flex w-full items-center gap-2'>
                  <span
                    className='size-2.5 shrink-0 rounded-[2px]'
                    style={{ background: item.payload?.fill }}
                  />
                  <span className='text-muted-foreground'>
                    {item.payload?.name}
                  </span>
                  <span className='ms-auto font-mono font-medium tabular-nums'>
                    {value} 小时
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={rows}
          dataKey='value'
          nameKey='key'
          innerRadius='58%'
          outerRadius='82%'
          paddingAngle={3}
          cornerRadius={6}
          strokeWidth={0}
        >
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) {
                return null
              }
              const { cx, cy } = viewBox
              return (
                <text x={cx} y={cy} textAnchor='middle'>
                  <tspan
                    x={cx}
                    y={(cy ?? 0) - 4}
                    className='fill-foreground text-2xl font-bold'
                  >
                    {Math.round(total * 10) / 10}
                  </tspan>
                  <tspan
                    x={cx}
                    y={(cy ?? 0) + 18}
                    className='fill-muted-foreground text-xs'
                  >
                    累计小时
                  </tspan>
                </text>
              )
            }}
          />
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey='key' />}
          itemSorter={null}
        />
      </PieChart>
    </ChartContainer>
  )
}
