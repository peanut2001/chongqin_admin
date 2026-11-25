import { useState } from 'react'
import { BookOpenCheck } from 'lucide-react'
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
import { PracticePanel } from './components/practice-panel'
import {
  practiceRecords,
  questionSets,
  type QuestionSet,
} from './data/questions'

export function QuestionBank() {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null)
  const totalQuestions = questionSets.reduce((sum, s) => sum + s.total, 0)

  return (
    <>
      <DefaultHeader />

      <Main>
        {activeSet ? (
          <PracticePanel
            key={activeSet.id}
            set={activeSet}
            onExit={() => setActiveSet(null)}
          />
        ) : (
          <>
            <div className='mb-4'>
              <h1 className='text-2xl font-bold tracking-tight'>题库练习</h1>
              <p className='text-muted-foreground'>
                共 {questionSets.length} 个章节、{totalQuestions}{' '}
                道题目，支持单选、多选、判断题，提交后即时显示解析。
              </p>
            </div>

            <Tabs defaultValue='sets' className='space-y-4'>
              <TabsList>
                <TabsTrigger value='sets'>章节练习</TabsTrigger>
                <TabsTrigger value='records'>练习记录</TabsTrigger>
              </TabsList>

              <TabsContent value='sets'>
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  {questionSets.map((s) => (
                    <Card key={s.id} className='flex flex-col'>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <BookOpenCheck className='size-5 text-primary' />
                          {s.name}
                        </CardTitle>
                        <CardDescription>{s.description}</CardDescription>
                      </CardHeader>
                      <CardContent className='flex-1 space-y-3'>
                        <div className='flex gap-2'>
                          <Badge variant='secondary'>题库 {s.total} 题</Badge>
                          <Badge variant='outline'>
                            本次可练 {s.questions.length} 题
                          </Badge>
                        </div>
                        <div className='space-y-1'>
                          <div className='flex justify-between text-xs text-muted-foreground'>
                            <span>班级平均正确率</span>
                            <span>{s.avgAccuracy}%</span>
                          </div>
                          <SimpleProgress value={s.avgAccuracy} />
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className='w-full'
                          onClick={() => setActiveSet(s)}
                        >
                          开始练习
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value='records'>
                <Card>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>记录编号</TableHead>
                          <TableHead>学生</TableHead>
                          <TableHead>章节</TableHead>
                          <TableHead className='text-end'>题数</TableHead>
                          <TableHead className='text-end'>正确率</TableHead>
                          <TableHead>用时</TableHead>
                          <TableHead>完成时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {practiceRecords.map((r) => {
                          const rate = Math.round((r.correct / r.count) * 100)
                          return (
                            <TableRow key={r.id}>
                              <TableCell className='text-muted-foreground'>
                                {r.id}
                              </TableCell>
                              <TableCell className='font-medium'>
                                {r.student}
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
                              <TableCell>{r.duration}</TableCell>
                              <TableCell className='text-muted-foreground'>
                                {r.finishedAt}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
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
