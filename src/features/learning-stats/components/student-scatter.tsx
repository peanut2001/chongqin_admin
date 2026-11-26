import { useMemo } from 'react'
import {
  alpha,
  axisStyle,
  baseOption,
  type echarts,
  tooltipHtml,
  tooltipStyle,
  useChartTheme,
} from '@/lib/echarts'
import { EChart } from '@/components/echart'
import { type StudentStat } from '../api'

/** 已作答（有正确率）的学生才能落到散点图上 */
export type PlottedStudent = StudentStat & { accuracy: number }

type Props = {
  students: PlottedStudent[]
  avgHours: number
  avgAccuracy: number | null
  /** 来自其他图表的筛选：不在集合内的点变淡；null 表示不筛选 */
  highlightIds: Set<string> | null
  /** 框选结果（userId 列表）；清除框选时为 null */
  onBrush: (ids: string[] | null) => void
  /** 点击某个学生的点 */
  onPick?: (userId: string) => void
  onReady: (chart: echarts.ECharts) => void
}

type BrushEvent = {
  batch: { areas: unknown[]; selected: { dataIndex: number[] }[] }[]
}

const symbolSize = (practice: number) =>
  Math.min(28, 8 + Math.sqrt(practice) * 1.4)

/**
 * 学生四象限：横轴学习时长、纵轴正确率、点大小 = 练习题数。
 * 虚线为平均值；左下象限（时长、正确率都低于平均）浅红底；
 * 需关注的学生带涟漪动效。支持框选联动下方明细表。
 */
export function StudentScatter({
  students,
  avgHours,
  avgAccuracy,
  highlightIds,
  onBrush,
  onPick,
  onReady,
}: Props) {
  const t = useChartTheme()

  const option = useMemo(() => {
    const ax = axisStyle(t)
    const maxHours = Math.max(1, ...students.map((s) => s.studyHours))
    const xMax = Math.ceil((maxHours * 1.15) / 2) * 2
    const minAcc = Math.min(100, ...students.map((s) => s.accuracy))
    const yMin = Math.max(0, Math.floor((minAcc - 8) / 10) * 10)
    const avgAcc = avgAccuracy ?? 0
    const point = (s: PlottedStudent) => [
      s.studyHours,
      s.accuracy,
      s.practiceCount,
      s.name,
    ]
    const colorOf = (s: PlottedStudent) =>
      s.needsAttention ? t.destructive : t.series.practice

    return {
      ...baseOption(t),
      animationDuration: 1200,
      animationEasing: 'elasticOut',
      animationDelay: (i: number) => i * 25,
      grid: { left: 8, right: 72, top: 44, bottom: 28, containLabel: true },
      toolbox: {
        right: 12,
        top: 4,
        itemSize: 15,
        iconStyle: { borderColor: t.mutedForeground },
        emphasis: { iconStyle: { borderColor: t.primary } },
        feature: {
          brush: {
            type: ['rect', 'clear'],
            title: { rect: '框选学生', clear: '清除框选' },
          },
        },
      },
      brush: {
        seriesIndex: [0],
        throttleType: 'debounce',
        throttleDelay: 250,
        brushStyle: {
          color: alpha(t.primary, 0.08),
          borderColor: alpha(t.primary, 0.6),
          borderWidth: 1,
        },
        outOfBrush: { colorAlpha: 0.15 },
      },
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'item',
        formatter: (p: { dataIndex: number; seriesIndex: number }) => {
          const s = students[p.dataIndex]
          if (p.seriesIndex !== 0 || !s) return ''
          const c = colorOf(s)
          return (
            tooltipHtml(
              `${s.name}${s.needsAttention ? '　<span style="color:' + t.destructive + '">需关注</span>' : ''}`,
              [
                { color: c, name: '班级', value: s.className ?? '—' },
                { color: c, name: '学习时长', value: `${s.studyHours} h` },
                { color: c, name: '正确率', value: `${s.accuracy}%` },
                { color: c, name: '练习题数', value: `${s.practiceCount}` },
              ]
            ) +
            `<div style="margin-top:4px;font-size:11px;opacity:.6">点击查看详情与 AI 分析</div>`
          )
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: xMax,
        name: '学习时长（小时）',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: t.mutedForeground, fontSize: 11 },
        ...ax,
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: 100,
        name: '正确率',
        nameTextStyle: { color: t.mutedForeground, fontSize: 11 },
        ...ax,
        axisLabel: { ...ax.axisLabel, formatter: '{value}%' },
      },
      series: [
        {
          type: 'scatter',
          z: 3,
          symbolSize: (v: number[]) => symbolSize(v[2]),
          emphasis: {
            scale: 1.5,
            label: {
              show: true,
              position: 'top',
              formatter: '{@[3]}',
              color: t.foreground,
              fontSize: 12,
              fontWeight: 600,
            },
          },
          data: students.map((s) => ({
            value: point(s),
            itemStyle: {
              color: alpha(colorOf(s), 0.85),
              borderColor: t.card,
              borderWidth: 1.5,
              opacity: highlightIds && !highlightIds.has(s.userId) ? 0.12 : 1,
              shadowBlur: 8,
              shadowColor: alpha(colorOf(s), 0.35),
            },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: t.mutedForeground, type: [5, 4], width: 1 },
            label: { color: t.mutedForeground, fontSize: 11 },
            data: [
              {
                xAxis: avgHours,
                label: { formatter: `人均 ${avgHours}h`, position: 'end' },
              },
              ...(avgAccuracy !== null
                ? [
                    {
                      yAxis: avgAcc,
                      label: { formatter: `平均 ${avgAcc}%`, position: 'end' },
                    },
                  ]
                : []),
            ],
          },
          markArea: {
            silent: true,
            label: {
              color: t.mutedForeground,
              fontSize: 11,
              position: 'insideTopLeft',
            },
            data:
              avgAccuracy !== null
                ? [
                    [
                      {
                        name: '待提升',
                        xAxis: 0,
                        yAxis: avgAcc,
                        itemStyle: { color: alpha(t.destructive, 0.06) },
                        label: { position: 'insideBottomLeft' },
                      },
                      { xAxis: avgHours, yAxis: yMin },
                    ],
                    [
                      {
                        name: '学得多 · 掌握好',
                        xAxis: avgHours,
                        yAxis: 100,
                        itemStyle: { color: alpha(t.series.practice, 0.06) },
                        label: { position: 'insideTopRight' },
                      },
                      { xAxis: xMax, yAxis: avgAcc },
                    ],
                  ]
                : [],
          },
        },
        {
          // 需关注学生的涟漪（仅装饰，不响应鼠标）
          type: 'effectScatter',
          silent: true,
          z: 2,
          symbolSize: (v: number[]) => symbolSize(v[2]),
          rippleEffect: { brushType: 'stroke', scale: 2.6, period: 3.5 },
          itemStyle: { color: t.destructive },
          data: students
            .filter(
              (s) =>
                s.needsAttention &&
                (!highlightIds || highlightIds.has(s.userId))
            )
            .map(point),
        },
      ],
    }
  }, [students, avgHours, avgAccuracy, highlightIds, t])

  const onEvents = useMemo(
    () => ({
      click: (e: unknown) => {
        const { seriesIndex, dataIndex } = e as {
          seriesIndex: number
          dataIndex: number
        }
        const s = students[dataIndex]
        if (seriesIndex === 0 && s) onPick?.(s.userId)
      },
      brushSelected: (e: unknown) => {
        const batch = (e as BrushEvent).batch[0] as
          | BrushEvent['batch'][0]
          | undefined
        if (!batch || batch.areas.length === 0) {
          onBrush(null)
          return
        }
        const idx = batch.selected[0]?.dataIndex ?? []
        onBrush(idx.map((i) => students[i].userId))
      },
    }),
    [students, onBrush, onPick]
  )

  return (
    <EChart
      option={option}
      height={420}
      merge
      onEvents={onEvents}
      onReady={onReady}
    />
  )
}
