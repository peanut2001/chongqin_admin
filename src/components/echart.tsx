import { useMemo, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts, baseOption, useChartTheme } from '@/lib/echarts'
import { cn } from '@/lib/utils'

type EChartProps = {
  option: object
  height: number | string
  className?: string
  onEvents?: Record<string, (params: unknown) => void>
  /** 拿到 ECharts 实例，用于跨图联动（dispatchAction 等） */
  onReady?: (chart: echarts.ECharts) => void
  /**
   * 合并更新：option 变化时做过渡动画而不是整图重绘，
   * 并保留框选等交互状态。默认整体替换。
   */
  merge?: boolean
}

export function EChart({
  option,
  height,
  className,
  onEvents,
  onReady,
  merge = false,
}: EChartProps) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge={!merge}
      lazyUpdate
      className={className}
      style={{ height, width: '100%' }}
      onEvents={onEvents}
      onChartReady={onReady}
    />
  )
}

export type DonutItem = {
  key: string
  name: string
  value: number
  color: string
}

type DonutProps = {
  items: DonutItem[]
  /** 数值显示格式，如 v => `${v} 小时` */
  format?: (v: number) => string
  /** 未悬停时中间显示的说明文字 */
  totalLabel: string
  /** half：半环（开口朝下） */
  variant?: 'full' | 'half'
  className?: string
}

/**
 * 环形图 / 半环图。中间显示合计，悬停扇区时改为显示该项的名称、数值与占比。
 * 颜色由调用方按实体传入（与其他图表保持一致）。
 */
export function DonutChart({
  items,
  format = (v) => v.toLocaleString(),
  totalLabel,
  variant = 'full',
  className,
}: DonutProps) {
  const t = useChartTheme()
  const [active, setActive] = useState<number | null>(null)
  const total = items.reduce((s, d) => s + d.value, 0)
  const half = variant === 'half'

  // option 不依赖悬停状态，避免悬停时整图重绘
  const option = useMemo(
    () => ({
      ...baseOption(t),
      tooltip: { show: false },
      series: [
        {
          type: 'pie',
          radius: half ? ['128%', '168%'] : ['60%', '82%'],
          center: half ? ['50%', '92%'] : ['50%', '50%'],
          startAngle: 180,
          endAngle: half ? 0 : 'auto',
          padAngle: 1.5,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderRadius: 6, borderColor: t.card, borderWidth: 2 },
          emphasis: { scale: true, scaleSize: 6 },
          data: items.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: d.color },
          })),
        },
      ],
    }),
    [items, t, half]
  )

  const onEvents = useMemo(
    () => ({
      mouseover: (p: unknown) =>
        setActive((p as { dataIndex: number }).dataIndex),
      mouseout: () => setActive(null),
    }),
    []
  )

  const hovered = active !== null ? items[active] : undefined
  const percent =
    hovered && total > 0 ? Math.round((hovered.value / total) * 100) : null

  return (
    <div
      className={cn(
        'relative w-full',
        half ? 'aspect-[2.3/1]' : 'aspect-square max-h-56',
        className
      )}
    >
      <EChart option={option} height='100%' onEvents={onEvents} />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 flex flex-col items-center',
          half ? 'bottom-[6%]' : 'top-1/2 -translate-y-1/2'
        )}
      >
        <span className='text-xs text-muted-foreground'>
          {hovered ? hovered.name : totalLabel}
        </span>
        <span
          className={cn(
            'font-bold tracking-tight tabular-nums',
            half ? 'text-3xl' : 'text-2xl'
          )}
        >
          {format(hovered ? hovered.value : Math.round(total * 10) / 10)}
        </span>
        {percent !== null && (
          <span className='text-xs font-medium text-muted-foreground'>
            占比 {percent}%
          </span>
        )}
      </div>
    </div>
  )
}
