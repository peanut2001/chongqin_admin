import { useMemo } from 'react'
import {
  alpha,
  axisStyle,
  baseOption,
  echarts,
  tooltipHtml,
  tooltipStyle,
  useChartTheme,
} from '@/lib/echarts'
import { EChart } from '@/components/echart'
import { ACCURACY_BANDS, type ClassRow, inBand } from '../analysis'
import { type StudentStat } from '../api'

/* ===================== 正确率分布 ===================== */

/** 各正确率区间的学生人数；点击柱子筛选该区间的学生（再点一次取消） */
export function AccuracyHistogram({
  students,
  activeBand,
  onSelect,
}: {
  students: StudentStat[]
  activeBand: number | null
  onSelect: (band: number | null) => void
}) {
  const t = useChartTheme()
  const option = useMemo(() => {
    const counts = ACCURACY_BANDS.map(
      (_, i) =>
        students.filter((s) => s.accuracy !== null && inBand(s.accuracy, i))
          .length
    )
    // 有序区间：同一色相由浅到深；<60% 是需要关注的区间，用警示色
    const ramp = [0.45, 0.6, 0.78, 1]
    const colorOf = (i: number) =>
      i === 0 ? t.destructive : alpha(t.series.practice, ramp[i - 1])
    return {
      ...baseOption(t),
      animationDuration: 1000,
      animationDelay: (i: number) => i * 120,
      grid: { left: 4, right: 4, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'item',
        formatter: (p: { dataIndex: number; value: number }) =>
          tooltipHtml(`正确率 ${ACCURACY_BANDS[p.dataIndex].label}`, [
            {
              color: colorOf(p.dataIndex),
              name: '学生',
              value: `${p.value} 人`,
            },
          ]) +
          `<div style="margin-top:4px;font-size:11px;opacity:.6">点击筛选这些学生</div>`,
      },
      xAxis: {
        type: 'category',
        data: ACCURACY_BANDS.map((b) => b.label),
        ...axisStyle(t),
        splitLine: { show: false },
      },
      yAxis: { type: 'value', minInterval: 1, splitNumber: 3, ...axisStyle(t) },
      series: [
        {
          type: 'bar',
          barWidth: '56%',
          cursor: 'pointer',
          label: {
            show: true,
            position: 'top',
            color: t.foreground,
            fontWeight: 600,
            formatter: '{c}',
          },
          data: counts.map((c, i) => ({
            value: c,
            itemStyle: {
              borderRadius: [6, 6, 2, 2],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: colorOf(i) },
                { offset: 1, color: alpha(colorOf(i), 0.55) },
              ]),
              opacity: activeBand === null || activeBand === i ? 1 : 0.25,
            },
          })),
        },
      ],
    }
  }, [students, activeBand, t])

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const i = (p as { dataIndex: number }).dataIndex
        onSelect(activeBand === i ? null : i)
      },
    }),
    [activeBand, onSelect]
  )

  return <EChart option={option} height={220} merge onEvents={onEvents} />
}

/* ===================== 班级对比 ===================== */

/** 各班平均正确率；点击某班切换整页到该班（再点一次回到全部班级） */
export function ClassCompare({
  rows,
  activeId,
  onSelect,
}: {
  rows: ClassRow[]
  activeId: number | null
  onSelect: (id: number | null) => void
}) {
  const t = useChartTheme()
  const option = useMemo(() => {
    const color = t.series.practice
    return {
      ...baseOption(t),
      animationDuration: 1000,
      grid: { left: 4, right: 96, top: 4, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(t),
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex]
          return (
            tooltipHtml(r.name, [
              { color, name: '学生', value: `${r.count} 人` },
              { color, name: '人均学时', value: `${r.hours} h` },
              {
                color,
                name: '平均正确率',
                value: r.accuracy === null ? '—' : `${r.accuracy}%`,
              },
              {
                color: t.destructive,
                name: '需关注',
                value: `${r.attention} 人`,
              },
            ]) +
            `<div style="margin-top:4px;font-size:11px;opacity:.6">点击查看该班</div>`
          )
        },
      },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map((r) => r.name),
        ...axisStyle(t),
        axisLabel: {
          ...axisStyle(t).axisLabel,
          color: t.foreground,
          fontSize: 12,
        },
      },
      series: [
        {
          type: 'bar',
          barWidth: 14,
          cursor: 'pointer',
          showBackground: true,
          backgroundStyle: { color: t.muted, borderRadius: 7 },
          label: {
            show: true,
            position: 'right',
            distance: 10,
            color: t.mutedForeground,
            fontSize: 11,
            formatter: (p: { dataIndex: number }) => {
              const r = rows[p.dataIndex]
              return `${r.accuracy ?? '—'}% · ${r.hours}h`
            },
          },
          data: rows.map((r) => ({
            value: r.accuracy ?? 0,
            itemStyle: {
              borderRadius: 7,
              color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                { offset: 0, color },
                { offset: 1, color: alpha(color, 0.45) },
              ]),
              opacity: activeId === null || activeId === r.id ? 1 : 0.3,
            },
          })),
        },
      ],
    }
  }, [rows, activeId, t])

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const r = rows[(p as { dataIndex: number }).dataIndex]
        if (r.id === null) return
        onSelect(activeId === r.id ? null : r.id)
      },
    }),
    [rows, activeId, onSelect]
  )

  return (
    <EChart
      option={option}
      height={Math.max(120, rows.length * 44)}
      merge
      onEvents={onEvents}
    />
  )
}
