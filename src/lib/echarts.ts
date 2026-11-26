import { useEffect, useState } from 'react'
import {
  BarChart,
  EffectScatterChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from 'echarts/charts'
import {
  BrushComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  PolarComponent,
  RadarComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/context/theme-provider'

// 按需注册，避免打包整个 ECharts
echarts.use([
  BarChart,
  EffectScatterChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  BrushComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  PolarComponent,
  RadarComponent,
  ToolboxComponent,
  TooltipComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

export { echarts }

/* ===================== 主题色：从 CSS 变量读取 ===================== */

export type ChartTheme = {
  series: { cases: string; practice: string; ai: string }
  primary: string
  destructive: string
  foreground: string
  muted: string
  mutedForeground: string
  border: string
  card: string
  popover: string
  fontFamily: string
}

let probe: CanvasRenderingContext2D | null = null

/** 把任意 CSS 颜色（含 oklch）转成 rgba()，ECharts 才能做透明度、渐变运算 */
function toRgba(color: string): string {
  probe ??= document.createElement('canvas').getContext('2d', {
    willReadFrequently: true,
  })
  if (!probe) return color
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
}

function readTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string) => toRgba(style.getPropertyValue(name).trim())
  return {
    // 与 theme.css 约定一致：chart-1 病例浏览，chart-2 练习，chart-3 AI 判读
    series: {
      cases: v('--chart-1'),
      practice: v('--chart-2'),
      ai: v('--chart-3'),
    },
    primary: v('--primary'),
    destructive: v('--destructive'),
    foreground: v('--foreground'),
    muted: v('--muted'),
    mutedForeground: v('--muted-foreground'),
    border: v('--border'),
    card: v('--card'),
    popover: v('--popover'),
    fontFamily: getComputedStyle(document.body).fontFamily,
  }
}

/** 当前主题下的图表颜色；切换浅色 / 深色后自动更新 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme()
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    // 主题类名在 ThemeProvider 的 effect 里切换，等下一帧再读取
    const id = requestAnimationFrame(() => setTheme(readTheme()))
    return () => cancelAnimationFrame(id)
  }, [resolvedTheme])
  return theme
}

/** 给 rgba() 颜色换透明度 */
export function alpha(rgba: string, a: number) {
  return rgba.replace(/[\d.]+\)$/, `${a})`)
}

/* ===================== 通用样式 ===================== */

export function baseOption(t: ChartTheme) {
  return {
    animationDuration: 900,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 400,
    textStyle: { fontFamily: t.fontFamily, color: t.mutedForeground },
  }
}

export function tooltipStyle(t: ChartTheme) {
  return {
    backgroundColor: t.popover,
    borderColor: t.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: t.foreground, fontSize: 12, fontFamily: t.fontFamily },
    extraCssText:
      'border-radius: 10px; box-shadow: 0 8px 24px -8px rgba(15, 23, 42, 0.18);',
  }
}

export function axisStyle(t: ChartTheme) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: t.mutedForeground, fontSize: 11 },
    splitLine: { lineStyle: { color: t.border, type: [4, 4] as number[] } },
  }
}

type Row = { color: string; name: string; value: string }

/** 提示框内容：标题 + 每行「色块 名称 …… 数值」 */
export function tooltipHtml(title: string | null, rows: Row[]) {
  const head = title
    ? `<div style="font-weight:600;margin-bottom:6px">${title}</div>`
    : ''
  const body = rows
    .map(
      (r) =>
        `<div style="display:flex;align-items:center;gap:8px;min-width:140px;line-height:20px">` +
        `<span style="width:8px;height:8px;border-radius:2px;background:${r.color}"></span>` +
        `<span style="opacity:.7">${r.name}</span>` +
        `<span style="margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums">${r.value}</span>` +
        `</div>`
    )
    .join('')
  return head + body
}
