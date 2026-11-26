import { useState } from 'react'
import { BookOpenCheck, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { SimpleProgress } from '@/components/simple-progress'
import { usePracticeRecords, useQuestionSets, useStartPractice } from './api'
import { PracticePanel } from './components/practice-panel'
import { type PracticeSession } from './data/questions'

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—'
  const m = Math.floor(seconds / 60)
  return m > 0 ? `${m} 分钟` : `${seconds} 秒`
}

export function QuestionBank() {
  const { data: sets, isLoading } = useQuestionSets()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [recordsPage, setRecordsPage] = useState(1)
  const records = usePracticeRecords(recordsPage)
  const start = useStartPractice()

  // 「开始练习」点击时才创建练习（不放在 effect 里，避免开发模式下重复创建）
  const startSet = (setId: string) =>
    start.mutate(setId, { onSuccess: setSession })

  return (
    <>
      <DefaultHeader />

      <Main>
        {session ? (
          <PracticePanel
            key={session.id}
            session={session}
            onExit={() => setSession(null)}
            onRestart={() => startSet(session.set.id)}
            restarting={start.isPending}
          />
        ) : (
          <>
            <Tabs defaultValue='sets' className='space-y-4'>
              <TabsList>
                <TabsTrigger value='sets'>章节练习</TabsTrigger>
                <TabsTrigger value='records'>练习记录</TabsTrigger>
              </TabsList>

              <TabsContent value='sets'>
                {isLoading && (
                  <p className='text-sm text-muted-foreground'>正在加载题库…</p>
                )}
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  {(sets ?? []).map((s) => (
                    <Card key={s.id} className='flex flex-col'>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <BookOpenCheck className='size-5 text-primary' />
                          {s.name}
                        </CardTitle>
                        <CardDescription>{s.description}</CardDescription>
                      </CardHeader>
                      <CardContent className='flex-1 space-y-3'>
                        <div className='flex flex-wrap gap-2'>
                          <Badge variant='secondary'>题库 {s.total} 题</Badge>
                          <Badge variant='outline'>
                            {s.sessionSize
                              ? `每次随机 ${s.sessionSize} 题`
                              : `每次 ${s.total} 题`}
                          </Badge>
                        </div>
                        {s.avgAccuracy !== null ? (
                          <div className='space-y-1'>
                            <div className='flex justify-between text-xs text-muted-foreground'>
                              <span>全体平均正确率</span>
                              <span>{s.avgAccuracy}%</span>
                            </div>
                            <SimpleProgress value={s.avgAccuracy} />
                          </div>
                        ) : (
                          <p className='text-xs text-muted-foreground'>
                            作答人次较少，暂不统计正确率
                          </p>
                        )}
                        <p className='text-xs text-muted-foreground'>
                          我已作答 {s.my.answered} 题
                          {s.my.accuracy !== null &&
                            `，正确率 ${s.my.accuracy}%`}
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className='w-full'
                          disabled={start.isPending || s.total === 0}
                          onClick={() => startSet(s.id)}
                        >
                          {start.isPending && start.variables === s.id && (
                            <Loader2 className='animate-spin' />
                          )}
                          开始练习
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value='records'>
                <Card>
                  <CardContent className='space-y-3'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>学生</TableHead>
                          <TableHead>学号</TableHead>
                          <TableHead>练习集</TableHead>
                          <TableHead className='text-end'>题数</TableHead>
                          <TableHead className='text-end'>正确率</TableHead>
                          <TableHead>用时</TableHead>
                          <TableHead>完成时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(records.data?.items ?? []).map((r) => {
                          const rate = r.count
                            ? Math.round((r.correct / r.count) * 100)
                            : 0
                          return (
                            <TableRow key={r.id}>
                              <TableCell className='font-medium'>
                                {r.student.name}
                              </TableCell>
                              <TableCell className='text-muted-foreground'>
                                {r.student.studentNo ?? '—'}
                              </TableCell>
                              <TableCell>{r.setName}</TableCell>
                              <TableCell className='text-end'>
                                {r.count}
                              </TableCell>
                              <TableCell className='text-end'>
                                <span
                                  className={
                                    rate >= 80
                                      ? 'text-emerald-600'
                                      : rate < 65
                                        ? 'text-rose-600'
                                        : ''
                                  }
                                >
                                  {rate}%
                                </span>
                              </TableCell>
                              <TableCell>
                                {formatDuration(r.durationSeconds)}
                              </TableCell>
                              <TableCell className='text-muted-foreground'>
                                {dateFmt.format(new Date(r.finishedAt))}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {records.data?.items.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className='h-20 text-center text-muted-foreground'
                            >
                              还没有练习记录。
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {records.data && records.data.total > 10 && (
                      <div className='flex items-center justify-end gap-2 text-sm text-muted-foreground'>
                        <span>
                          第 {recordsPage} 页，共{' '}
                          {Math.ceil(records.data.total / 10)} 页
                        </span>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={recordsPage === 1}
                          onClick={() => setRecordsPage((p) => p - 1)}
                        >
                          上一页
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={recordsPage * 10 >= records.data.total}
                          onClick={() => setRecordsPage((p) => p + 1)}
                        >
                          下一页
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </Main>
    </>
  )
}
