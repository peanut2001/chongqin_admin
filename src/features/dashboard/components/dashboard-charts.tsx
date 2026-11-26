import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  type PieLabelRenderProps,
  XAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { SimpleProgress } from '@/components/simple-progress'
import {
  type ChapterMastery,
  type Kpis,
  type ModuleUsage,
  type WeeklyActivity,
} from '@/features/learning-stats/api'

/** 掌握度低于该值的章节高亮显示 */
const WEAK_MASTERY = 60

const moduleColors: Record<string, string> = {
  cases: 'var(--chart-1)',
  practice: 'var(--chart-2)',
  ai: 'var(--chart-3)',
}

const RADIAN = Math.PI / 180

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

/** 扇区外侧的百分比标签 */
function percentLabel(offset: number) {
  return function Render(props: PieLabelRenderProps) {
    const cx = Number(props.cx)
    const cy = Number(props.cy)
    const r = Number(props.outerRadius) + offset
    const angle = -Number(props.midAngle) * RADIAN
    const percent = Number(props.percent)
    if (!percent) return null
    return (
      <text
        x={cx + r * Math.cos(angle)}
        y={cy + r * Math.sin(angle)}
        textAnchor='middle'
        dominantBaseline='central'
        className='fill-muted-foreground text-[11px] font-medium'
      >
        {Math.round(percent * 100)}%
      </text>
    )
  }
}

function LegendList({
  items,
}: {
  items: { key: string; name: string; color: string; value: string }[]
}) {
  return (
    <ul className='space-y-2.5 text-xs'>
      {items.map((it) => (
        <li key={it.key} className='flex items-center gap-2'>
          <span
            className='size-2.5 shrink-0 rounded-[3px]'
            style={{ background: it.color }}
          />
          <span className='text-muted-foreground'>{it.name}</span>
          <span className='ms-auto font-medium tabular-nums'>{it.value}</span>
        </li>
      ))}
    </ul>
  )
}

/** 学习时长分布：半环图 + 下方图例 */
export function StudyTimeGauge({ data }: { data: ModuleUsage[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <Empty text='暂无学习记录' />
  const config = Object.fromEntries(
    data.map((d) => [
      d.key,
      { label: d.name, color: moduleColors[d.key] ?? 'var(--chart-4)' },
    ])
  ) satisfies ChartConfig
  const rows = data.map((d) => ({ ...d, fill: `var(--color-${d.key})` }))
  const top = data.reduce((a, b) => (b.value > a.value ? b : a))
  const topPercent = Math.round((top.value / total) * 100)

  return (
    <div className='flex h-full flex-col justify-between gap-4'>
      <div className='relative w-full'>
        <ChartContainer config={config} className='aspect-auto h-64 w-full'>
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey='key'
                  hideLabel
                  formatter={(value, _n, item) => (
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
              cx='50%'
              cy='90%'
              startAngle={180}
              endAngle={0}
              innerRadius='88%'
              outerRadius='130%'
              paddingAngle={2}
              cornerRadius={4}
              strokeWidth={0}
              label={percentLabel(16)}
              labelLine={false}
            />
          </PieChart>
        </ChartContainer>
        <div className='pointer-events-none absolute inset-x-0 bottom-4 text-center'>
          <div className='text-4xl font-bold'>{topPercent}%</div>
          <div className='text-xs text-muted-foreground'>{top.name}</div>
        </div>
      </div>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        {data.map((d) => (
          <div key={d.key} className='rounded-lg border bg-card px-3 py-2'>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <span
                className='size-2 shrink-0 rounded-[2px]'
                style={{ background: moduleColors[d.key] ?? 'var(--chart-4)' }}
              />
              {d.name}
            </div>
            <div className='mt-1 text-sm font-semibold tabular-nums'>
              {d.value}
              <span className='ms-0.5 text-xs font-normal text-muted-foreground'>
                小时
              </span>
            </div>
          </div>
        ))}
        <div className='rounded-lg bg-muted/60 px-3 py-2'>
          <div className='text-xs text-muted-foreground'>合计</div>
          <div className='mt-1 text-sm font-semibold tabular-nums'>
            {Math.round(total * 10) / 10}
            <span className='ms-0.5 text-xs font-normal text-muted-foreground'>
              小时
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const mixConfig = {
  caseViews: { label: '病例浏览', color: 'var(--chart-1)' },
  practice: { label: '练习题数', color: 'var(--chart-2)' },
  aiReads: { label: 'AI 判读', color: 'var(--chart-3)' },
} satisfies ChartConfig

/** 学习行为构成：本学期三类学习次数占比 */
export function ActivityMixPie({ kpis }: { kpis: Kpis }) {
  const rows = [
    { key: 'caseViews', value: kpis.totalCaseViews },
    { key: 'practice', value: kpis.totalPractice },
    { key: 'aiReads', value: kpis.totalAiReads },
  ].map((r) => ({ ...r, fill: `var(--color-${r.key})` }))
  if (rows.every((r) => r.value === 0)) return <Empty text='暂无学习记录' />
  return (
    <div className='flex h-full flex-col gap-3'>
      <ChartContainer config={mixConfig} className='aspect-auto h-52 w-full'>
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent nameKey='key' hideLabel />}
          />
          <Pie
            data={rows}
            dataKey='value'
            nameKey='key'
            innerRadius={0}
            outerRadius={72}
            paddingAngle={1}
            stroke='var(--card)'
            strokeWidth={2}
            label={percentLabel(14)}
            labelLine={false}
          />
        </PieChart>
      </ChartContainer>
      <LegendList
        items={rows.map((r) => ({
          key: r.key,
          name: mixConfig[r.key as keyof typeof mixConfig].label,
          color: mixConfig[r.key as keyof typeof mixConfig].color,
          value: r.value.toLocaleString(),
        }))}
      />
    </div>
  )
}

const accuracyConfig = {
  accuracy: { label: '平均正确率(%)', color: 'var(--chart-2)' },
} satisfies ChartConfig

/** 各周平均正确率，突出本周 */
export function AccuracyTrend({ data }: { data: WeeklyActivity[] }) {
  const cur = data[data.length - 1] as WeeklyActivity | undefined
  if (!cur || data.every((w) => w.accuracy === null)) {
    return <Empty text='暂无作答数据' />
  }
  const last = data.length - 1
  return (
    <div className='flex h-full flex-col gap-3'>
      <div className='flex items-baseline gap-2'>
        <span className='text-3xl font-bold text-primary'>
          {cur.accuracy ?? '—'}
          {cur.accuracy !== null && <span className='text-lg'>%</span>}
        </span>
        <span className='text-xs text-muted-foreground'>
          {cur.week}平均正确率
        </span>
      </div>
      <ChartContainer
        config={accuracyConfig}
        className='aspect-auto min-h-48 w-full flex-1'
      >
        <BarChart data={data} margin={{ top: 24, left: 4, right: 4 }}>
          <XAxis
            dataKey='week'
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            fontSize={10}
            tickFormatter={(v: string) => v.replace(/[第周]/g, '')}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator='line' />}
          />
          <Bar dataKey='accuracy' radius={[4, 4, 4, 4]} maxBarSize={18}>
            {data.map((w, i) => (
              <Cell
                key={w.week}
                fill='var(--color-accuracy)'
                fillOpacity={i === last ? 1 : 0.3}
              />
            ))}
            <LabelList
              dataKey='accuracy'
              content={(props) => {
                if (props.index !== last || props.value == null) return null
                const x = Number(props.x) + Number(props.width) / 2
                const y = Number(props.y) - 14
                return (
                  <g>
                    <rect
                      x={x - 16}
                      y={y - 9}
                      width={32}
                      height={18}
                      rx={4}
                      className='fill-foreground'
                    />
                    <text
                      x={x}
                      y={y}
                      textAnchor='middle'
                      dominantBaseline='central'
                      className='fill-background text-[10px] font-semibold'
                    >
                      {props.value}
                    </text>
                  </g>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

/** 章节掌握度：进度条列表 */
export function ChapterMasteryList({ data }: { data: ChapterMastery[] }) {
  if (data.length === 0) return <Empty text='暂无作答数据' />
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
