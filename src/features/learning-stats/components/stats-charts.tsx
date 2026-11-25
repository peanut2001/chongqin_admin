import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type ChapterMastery,
  type ModuleUsage,
  type WeeklyActivity,
} from '../api'

const axisProps = {
  stroke: '#888888',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const

const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--popover-foreground)' },
}

const moduleColors: Record<string, string> = {
  cases: 'var(--chart-1)',
  practice: 'var(--chart-2)',
  ai: 'var(--chart-3)',
}

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
    <ResponsiveContainer width='100%' height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray='3 3' vertical={false} opacity={0.3} />
        <XAxis dataKey='week' {...axisProps} />
        <YAxis yAxisId='left' allowDecimals={false} {...axisProps} />
        <YAxis
          yAxisId='right'
          orientation='right'
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          {...axisProps}
        />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId='left'
          dataKey='practice'
          name='练习题数'
          fill='var(--chart-2)'
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId='left'
          dataKey='aiReads'
          name='AI 判读次数'
          fill='var(--chart-3)'
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId='right'
          type='monotone'
          dataKey='accuracy'
          name='平均正确率(%)'
          stroke='var(--chart-1)'
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** 各章节掌握度（作答正确率） */
export function ChapterMasteryChart({
  data,
  height = 260,
}: {
  data: ChapterMastery[]
  height?: number
}) {
  if (data.length === 0) return <Empty height={height} text='暂无作答数据' />
  return (
    <ResponsiveContainer width='100%' height={height}>
      <BarChart data={data} layout='vertical' margin={{ left: 8 }}>
        <XAxis
          type='number'
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          {...axisProps}
        />
        <YAxis type='category' dataKey='chapter' width={64} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, '掌握度']} />
        <Bar
          dataKey='mastery'
          fill='var(--chart-2)'
          radius={[0, 4, 4, 0]}
          barSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 功能模块学习时长占比 */
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
  return (
    <ResponsiveContainer width='100%' height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey='value'
          nameKey='name'
          innerRadius='55%'
          outerRadius='80%'
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={moduleColors[d.key] ?? 'var(--chart-4)'} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [`${v} 小时`, '学习时长']}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
