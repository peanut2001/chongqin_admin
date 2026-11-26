import { type StudentStat } from './api'

/** 正确率区间（有序） */
export const ACCURACY_BANDS = [
  { label: '<60%', min: 0, max: 60 },
  { label: '60–70%', min: 60, max: 70 },
  { label: '70–80%', min: 70, max: 80 },
  { label: '80–90%', min: 80, max: 90 },
  { label: '≥90%', min: 90, max: 101 },
] as const

export function inBand(accuracy: number, band: number) {
  const b = ACCURACY_BANDS[band]
  return accuracy >= b.min && accuracy < b.max
}

export type ClassRow = {
  id: number | null
  name: string
  count: number
  hours: number
  accuracy: number | null
  attention: number
}

/** 由学生明细汇总各班：人数、人均学时、正确率（按题数加权）、需关注人数 */
export function summarizeClasses(
  students: StudentStat[],
  classes: { id: number; name: string }[]
): ClassRow[] {
  const groups = new Map<string, StudentStat[]>()
  for (const s of students) {
    const key = s.className ?? '未分班'
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  return [...groups.entries()].map(([name, list]) => {
    const answered = list.reduce((n, s) => n + s.practiceCount, 0)
    const weighted = list.reduce(
      (n, s) => n + (s.accuracy ?? 0) * s.practiceCount,
      0
    )
    return {
      id: classes.find((c) => c.name === name)?.id ?? null,
      name,
      count: list.length,
      hours:
        Math.round(
          (list.reduce((n, s) => n + s.studyHours, 0) / list.length) * 10
        ) / 10,
      accuracy: answered ? Math.round((weighted / answered) * 10) / 10 : null,
      attention: list.filter((s) => s.needsAttention).length,
    }
  })
}
