import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type WeeklyActivity } from '@/features/learning-stats/api'

/** 各教学周学习活跃度（堆叠柱状图） */
export function Overview({ data }: { data: WeeklyActivity[] }) {
  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey='week'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          direction='ltr'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--popover-foreground)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey='caseViews'
          name='病例浏览'
          stackId='a'
          fill='var(--chart-1)'
        />
        <Bar
          dataKey='practice'
          name='练习题数'
          stackId='a'
          fill='var(--chart-2)'
        />
        <Bar
          dataKey='aiReads'
          name='AI 判读'
          stackId='a'
          fill='var(--chart-3)'
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
