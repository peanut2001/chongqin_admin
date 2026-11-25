import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleX,
  Lightbulb,
  RotateCcw,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { SimpleProgress } from '@/components/simple-progress'
import { type Question, type QuestionSet } from '../data/questions'

type Props = {
  set: QuestionSet
  onExit: () => void
}

const isCorrect = (q: Question, picked: string[] = []) =>
  picked.length === q.answer.length && q.answer.every((a) => picked.includes(a))

export function PracticePanel({ set, onExit }: Props) {
  const { questions } = set
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)

  const q = questions[index]
  const current = picked[q.id] ?? []
  const isSubmitted = !!submitted[q.id]
  const correctCount = questions.filter(
    (item) => submitted[item.id] && isCorrect(item, picked[item.id])
  ).length

  const toggle = (key: string) => {
    if (isSubmitted) return
    setPicked((prev) => {
      const list = prev[q.id] ?? []
      const next =
        q.type === '多选题'
          ? list.includes(key)
            ? list.filter((k) => k !== key)
            : [...list, key].sort()
          : [key]
      return { ...prev, [q.id]: next }
    })
  }

  const restart = () => {
    setIndex(0)
    setPicked({})
    setSubmitted({})
    setFinished(false)
  }

  if (finished) {
    const score = Math.round((correctCount / questions.length) * 100)
    return (
      <Card className='mx-auto w-full max-w-2xl'>
        <CardHeader className='items-center text-center'>
          <Trophy className='mx-auto size-10 text-amber-500' />
          <CardTitle className='text-xl'>练习完成</CardTitle>
          <CardDescription>{set.name}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-3 gap-4 text-center'>
            <Stat label='得分' value={`${score}`} />
            <Stat label='答对' value={`${correctCount}/${questions.length}`} />
            <Stat label='班级平均正确率' value={`${set.avgAccuracy}%`} />
          </div>
          <ul className='space-y-2'>
            {questions.map((item, i) => {
              const ok = isCorrect(item, picked[item.id])
              return (
                <li
                  key={item.id}
                  className='flex items-start gap-2 rounded-md border p-3 text-sm'
                >
                  {ok ? (
                    <CircleCheck className='mt-0.5 size-4 shrink-0 text-emerald-600' />
                  ) : (
                    <CircleX className='mt-0.5 size-4 shrink-0 text-rose-600' />
                  )}
                  <div className='space-y-1'>
                    <p className='line-clamp-2'>
                      {i + 1}. {item.stem}
                    </p>
                    <p className='flex gap-4 text-xs text-muted-foreground'>
                      <span>
                        你的答案：{(picked[item.id] ?? []).join('') || '未作答'}
                      </span>
                      <span>正确答案：{item.answer.join('')}</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
        <CardFooter className='justify-center gap-2'>
          <Button variant='outline' onClick={onExit}>
            返回题库
          </Button>
          <Button onClick={restart}>
            <RotateCcw />
            再练一次
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className='mx-auto w-full max-w-3xl'>
      <CardHeader>
        <div className='flex items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={onExit}>
            <ArrowLeft />
            退出练习
          </Button>
          <span className='text-sm text-muted-foreground'>
            {set.name} · 第 {index + 1}/{questions.length} 题
          </span>
        </div>
        <SimpleProgress value={((index + 1) / questions.length) * 100} />
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary'>{q.type}</Badge>
          {q.caseId && <Badge variant='outline'>关联病例 {q.caseId}</Badge>}
        </div>
        <p className='leading-relaxed font-medium'>{q.stem}</p>

        <div className='space-y-2'>
          {q.options.map((opt) => {
            const selected = current.includes(opt.key)
            const right = q.answer.includes(opt.key)
            return (
              <button
                key={opt.key}
                type='button'
                onClick={() => toggle(opt.key)}
                disabled={isSubmitted}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-start text-sm transition',
                  !isSubmitted && 'hover:bg-accent',
                  !isSubmitted && selected && 'border-primary bg-primary/5',
                  isSubmitted &&
                    right &&
                    'border-emerald-500 bg-emerald-50 dark:bg-emerald-950',
                  isSubmitted &&
                    selected &&
                    !right &&
                    'border-rose-500 bg-rose-50 dark:bg-rose-950'
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center border text-xs font-semibold',
                    q.type === '多选题' ? 'rounded' : 'rounded-full',
                    selected &&
                      'border-primary bg-primary text-primary-foreground'
                  )}
                >
                  {q.type === '判断题'
                    ? opt.key === 'T'
                      ? '√'
                      : '×'
                    : opt.key}
                </span>
                {opt.text}
              </button>
            )
          })}
        </div>

        {isSubmitted && (
          <div
            className={cn(
              'space-y-1 rounded-md border p-4 text-sm',
              isCorrect(q, current)
                ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/40'
                : 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/40'
            )}
          >
            <p className='flex items-center gap-1 font-semibold'>
              {isCorrect(q, current) ? (
                <>
                  <CircleCheck className='size-4 text-emerald-600' /> 回答正确
                </>
              ) : (
                <>
                  <CircleX className='size-4 text-rose-600' />{' '}
                  回答错误，正确答案：
                  {q.answer.join('')}
                </>
              )}
            </p>
            <p className='flex gap-1 text-muted-foreground'>
              <Lightbulb className='mt-0.5 size-4 shrink-0 text-amber-500' />
              {q.explanation}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className='justify-between'>
        <Button
          variant='outline'
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          <ArrowLeft />
          上一题
        </Button>
        {!isSubmitted ? (
          <Button
            disabled={current.length === 0}
            onClick={() => setSubmitted((s) => ({ ...s, [q.id]: true }))}
          >
            提交答案
          </Button>
        ) : index < questions.length - 1 ? (
          <Button onClick={() => setIndex((i) => i + 1)}>
            下一题
            <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => setFinished(true)}>查看成绩</Button>
        )}
      </CardFooter>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border p-3'>
      <div className='text-2xl font-bold'>{value}</div>
      <div className='text-xs text-muted-foreground'>{label}</div>
    </div>
  )
}
