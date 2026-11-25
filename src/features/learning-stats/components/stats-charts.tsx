import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { chapterMastery, moduleUsage, weeklyActivity } from '../data/stats'

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

/** 每周练习量 + 平均正确率 */
export function WeeklyTrendChart({ height = 320 }: { height?: number }) {
  return (
    <ResponsiveContainer width='100%' height={height}>
      <ComposedChart data={weeklyActivity}>
        <CartesianGrid strokeDasharray='3 3' vertical={false} opacity={0.3} />
        <XAxis dataKey='week' {...axisProps} />
        <YAxis yAxisId='left' {...axisProps} />
        <YAxis
          yAxisId='right'
          orientation='right'
          domain={[50, 100]}
          tickFormatter={(v) => `${v}%`}
          {...axisProps}
        />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId='left'
          dataKey='practice'
          name='练习次数'
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

/** 各章节掌握度 */
export function ChapterMasteryChart({ height = 260 }: { height?: number }) {
  return (
    <ResponsiveContainer width='100%' height={height}>
      <BarChart data={chapterMastery} layout='vertical' margin={{ left: 8 }}>
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
export function ModuleUsageChart({ height = 260 }: { height?: number }) {
  return (
    <ResponsiveContainer width='100%' height={height}>
      <PieChart>
        <Pie
          data={moduleUsage}
          dataKey='value'
          nameKey='name'
          innerRadius='55%'
          outerRadius='80%'
          paddingAngle={2}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [`${v} 小时`, '学习时长']}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
