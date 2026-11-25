import { useMemo, useState } from 'react'
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
  ChapterMasteryChart,
  ModuleUsageChart,
  WeeklyTrendChart,
} from './components/stats-charts'
import { classes, semester, studentStats, type StudentStat } from './data/stats'

type SortKey = 'accuracy' | 'studyHours' | 'practiceCount'

const sortText: Record<SortKey, string> = {
  accuracy: '按正确率',
  studyHours: '按学习时长',
  practiceCount: '按练习题数',
}

/** 正确率 < 65% 或学习时长 < 30 小时视为需关注 */
const needsAttention = (s: StudentStat) => s.accuracy < 65 || s.studyHours < 30

export function LearningStats() {
  const [klass, setKlass] = useState(classes[0])
  const [sortKey, setSortKey] = useState<SortKey>('accuracy')

  const students = useMemo(
    () =>
      studentStats
        .filter((s) => klass === classes[0] || s.className === klass)
        .sort((a, b) => b[sortKey] - a[sortKey]),
    [klass, sortKey]
  )

  const summary = useMemo(() => {
    const n = students.length || 1
    const sum = (
      k: keyof Pick<StudentStat, 'studyHours' | 'practiceCount' | 'accuracy'>
    ) => students.reduce((acc, s) => acc + s[k], 0)
    return {
      count: students.length,
      avgHours: (sum('studyHours') / n).toFixed(1),
      totalPractice: sum('practiceCount'),
      avgAccuracy: Math.round(sum('accuracy') / n),
      attention: students.filter(needsAttention).length,
    }
  }, [students])

  return (
    <>
      <DefaultHeader />

      <Main className='space-y-4'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>学情统计</h1>
            <p className='text-muted-foreground'>
              {semester.course} · {semester.name} · 第 {semester.currentWeek}/
              {semester.totalWeeks} 教学周
            </p>
          </div>
          <Select value={klass} onValueChange={setKlass}>
            <SelectTrigger className='w-52'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <KpiCard
            title='在学人数'
            value={`${summary.count} 人`}
            hint={`需关注 ${summary.attention} 人`}
          />
          <KpiCard
            title='人均学习时长'
            value={`${summary.avgHours} h`}
            hint='本学期累计'
          />
          <KpiCard
            title='累计练习题数'
            value={summary.totalPractice.toLocaleString()}
            hint='含章节练习与组卷'
          />
          <KpiCard
            title='平均正确率'
            value={`${summary.avgAccuracy}%`}
            hint='按学生个人正确率平均'
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>学习趋势</CardTitle>
            <CardDescription>
              各教学周练习次数、AI 判读次数与平均正确率
            </CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <WeeklyTrendChart />
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>章节掌握度</CardTitle>
              <CardDescription>按章节统计的班级平均正确率</CardDescription>
            </CardHeader>
            <CardContent>
              <ChapterMasteryChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>模块使用分布</CardTitle>
              <CardDescription>各功能模块累计学习时长</CardDescription>
            </CardHeader>
            <CardContent>
              <ModuleUsageChart />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
            <div className='space-y-1.5'>
              <CardTitle>学生学情明细</CardTitle>
              <CardDescription>
                正确率低于 65% 或学习时长不足 30 小时的学生标记为「需关注」
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
                  <TableRow key={s.id}>
                    <TableCell className='text-muted-foreground'>
                      {s.id}
                    </TableCell>
                    <TableCell className='font-medium'>
                      <span className='flex items-center gap-2'>
                        {s.name}
                        {needsAttention(s) && (
                          <Badge variant='destructive'>需关注</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{s.className}</TableCell>
                    <TableCell className='text-end'>{s.studyHours}</TableCell>
                    <TableCell className='text-end'>
                      {s.practiceCount}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <SimpleProgress value={s.accuracy} className='w-20' />
                        <span className='text-sm'>{s.accuracy}%</span>
                      </div>
                    </TableCell>
                    <TableCell className='text-end'>{s.caseViews}</TableCell>
                    <TableCell className='text-end'>{s.aiReads}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {s.lastActive}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>
    </>
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
