import { useMemo, useState } from 'react'
import { apiErrorTitle } from '@/lib/api/client'
import { useMeta } from '@/lib/api/meta'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { SimpleProgress } from '@/components/simple-progress'
import {
  formatRelativeTime,
  type StudentStat,
  useStatsOverview,
  useStudentStats,
} from './api'
import {
  ChapterMasteryChart,
  ModuleUsageChart,
  WeeklyTrendChart,
} from './components/stats-charts'

type SortKey = 'accuracy' | 'studyHours' | 'practiceCount'

const sortText: Record<SortKey, string> = {
  accuracy: '按正确率',
  studyHours: '按学习时长',
  practiceCount: '按练习题数',
}

const ALL = 'all'

export function LearningStats() {
  const { data: meta } = useMeta()
  const [klass, setKlass] = useState(ALL)
  const [sortKey, setSortKey] = useState<SortKey>('accuracy')
  const classId = klass === ALL ? undefined : Number(klass)

  const overview = useStatsOverview(classId)
  const studentsQuery = useStudentStats(classId)

  const students = useMemo(
    () =>
      // 没有作答（正确率为空）的学生排在最后
      [...(studentsQuery.data ?? [])].sort(
        (a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1)
      ),
    [studentsQuery.data, sortKey]
  )

  const semester = overview.data?.semester ?? meta?.semester
  const kpis = overview.data?.kpis

  return (
    <>
      <DefaultHeader />

      <Main className='space-y-4'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>学情统计</h1>
            <p className='text-muted-foreground'>
              {semester
                ? `${semester.course} · ${semester.name} · 第 ${semester.currentWeek}/${semester.totalWeeks} 教学周`
                : '尚未设置当前学期'}
            </p>
          </div>
          <Select value={klass} onValueChange={setKlass}>
            <SelectTrigger className='w-52'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部班级</SelectItem>
              {(meta?.classes ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {overview.isError && (
          <p className='text-sm text-destructive'>
            {apiErrorTitle(overview.error, '统计数据加载失败。')}
          </p>
        )}

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <KpiCard
            title='在学人数'
            value={kpis ? `${kpis.studentCount} 人` : '—'}
            hint={
              kpis
                ? `近 7 天活跃 ${kpis.activeStudents7d} 人，需关注 ${kpis.needsAttention} 人`
                : ''
            }
          />
          <KpiCard
            title='人均学习时长'
            value={kpis ? `${kpis.avgStudyHours} h` : '—'}
            hint='本学期累计（练习 + 病例浏览 + AI 判读）'
          />
          <KpiCard
            title='累计练习题数'
            value={kpis ? kpis.totalPractice.toLocaleString() : '—'}
            hint={
              kpis
                ? `病例浏览 ${kpis.totalCaseViews.toLocaleString()} 次，AI 判读 ${kpis.totalAiReads.toLocaleString()} 次`
                : ''
            }
          />
          <KpiCard
            title='平均正确率'
            value={kpis?.avgAccuracy != null ? `${kpis.avgAccuracy}%` : '—'}
            hint='全部作答的总体正确率'
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>学习趋势</CardTitle>
            <CardDescription>
              各教学周练习题数、AI 判读次数与平均正确率
            </CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <WeeklyTrendChart data={overview.data?.weeklyActivity ?? []} />
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>章节掌握度</CardTitle>
              <CardDescription>按练习集统计的作答正确率</CardDescription>
            </CardHeader>
            <CardContent>
              <ChapterMasteryChart data={overview.data?.chapterMastery ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>模块使用分布</CardTitle>
              <CardDescription>各功能模块累计学习时长（小时）</CardDescription>
            </CardHeader>
            <CardContent>
              <ModuleUsageChart data={overview.data?.moduleUsage ?? []} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
            <div className='space-y-1.5'>
              <CardTitle>学生学情明细</CardTitle>
              <CardDescription>
                正确率低于 65% 或学习时长不足
                {kpis ? ` ${kpis.attentionHoursThreshold} ` : ' '}
                小时（按学期进度折算）的学生标记为「需关注」
              </CardDescription>
            </div>
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(sortText) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {sortText[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead className='text-end'>学习时长(h)</TableHead>
                  <TableHead className='text-end'>练习题数</TableHead>
                  <TableHead className='w-40'>正确率</TableHead>
                  <TableHead className='text-end'>病例浏览</TableHead>
                  <TableHead className='text-end'>AI 判读</TableHead>
                  <TableHead>最近学习</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <StudentRow key={s.userId} s={s} />
                ))}
                {studentsQuery.data?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='h-20 text-center text-muted-foreground'
                    >
                      该班级暂无学生。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

function StudentRow({ s }: { s: StudentStat }) {
  return (
    <TableRow>
      <TableCell className='text-muted-foreground'>{s.id}</TableCell>
      <TableCell className='font-medium'>
        <span className='flex items-center gap-2'>
          {s.name}
          {s.needsAttention && <Badge variant='destructive'>需关注</Badge>}
        </span>
      </TableCell>
      <TableCell>{s.className ?? '—'}</TableCell>
      <TableCell className='text-end'>{s.studyHours}</TableCell>
      <TableCell className='text-end'>{s.practiceCount}</TableCell>
      <TableCell>
        {s.accuracy !== null ? (
          <div className='flex items-center gap-2'>
            <SimpleProgress value={s.accuracy} className='w-20' />
            <span className='text-sm'>{s.accuracy}%</span>
          </div>
        ) : (
          <span className='text-sm text-muted-foreground'>未作答</span>
        )}
      </TableCell>
      <TableCell className='text-end'>{s.caseViews}</TableCell>
      <TableCell className='text-end'>{s.aiReads}</TableCell>
      <TableCell className='text-muted-foreground'>
        {formatRelativeTime(s.lastActive)}
      </TableCell>
    </TableRow>
  )
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardDescription>{title}</CardDescription>
        <CardTitle className='text-2xl'>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className='text-xs text-muted-foreground'>{hint}</p>
      </CardContent>
    </Card>
  )
}
