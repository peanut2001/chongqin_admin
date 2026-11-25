import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleX,
  FolderHeart,
  Lightbulb,
  Loader2,
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
import { useFinishPractice, useSubmitAnswer } from '../api'
import {
  type AnswerResult,
  type FinishResult,
  type PracticeSession,
} from '../data/questions'

type Props = {
  session: PracticeSession
  onExit: () => void
  /** 再练一次：服务端重新抽题，开始新的一次练习 */
  onRestart: () => void
  restarting?: boolean
}

/** 判分在后端：每题提交后才拿到对错、答案、解析与图注 */
export function PracticePanel({
  session,
  onExit,
  onRestart,
  restarting,
}: Props) {
  const { questions } = session
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [results, setResults] = useState<Record<string, AnswerResult>>({})
  const [summary, setSummary] = useState<FinishResult | null>(null)
  // 当前题目开始展示的时间，用于记录每题作答用时
  const [mountedAt] = useState(() => Date.now())
  const shownAt = useRef(mountedAt)
  const submit = useSubmitAnswer(session.id)
  const finish = useFinishPractice(session.id)

  const q = questions[index]
  const current = picked[q.id] ?? []
  const result = results[q.id]
  const isSubmitted = !!result

  const goTo = (i: number) => {
    setIndex(i)
    shownAt.current = Date.now()
  }

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

  const submitAnswer = () =>
    submit.mutate(
      {
        questionId: q.id,
        selected: current,
        timeSpentMs: Date.now() - shownAt.current,
      },
      { onSuccess: (r) => setResults((prev) => ({ ...prev, [q.id]: r })) }
    )

  if (summary) {
    return (
      <Card className='mx-auto w-full max-w-2xl'>
        <CardHeader className='items-center text-center'>
          <Trophy className='mx-auto size-10 text-amber-500' />
          <CardTitle className='text-xl'>练习完成</CardTitle>
          <CardDescription>{session.set.name}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-3 gap-4 text-center'>
            <Stat label='得分' value={`${summary.score}`} />
            <Stat
              label='答对'
              value={`${summary.correctCount}/${summary.questionCount}`}
            />
            <Stat
              label='全体平均正确率'
              value={
                summary.classAvgAccuracy !== null
                  ? `${summary.classAvgAccuracy}%`
                  : '—'
              }
            />
          </div>
          <ul className='space-y-2'>
            {summary.items.map((item, i) => (
              <li
                key={item.questionId}
                className='flex items-start gap-2 rounded-md border p-3 text-sm'
              >
                {item.correct ? (
                  <CircleCheck className='mt-0.5 size-4 shrink-0 text-emerald-600' />
                ) : (
                  <CircleX className='mt-0.5 size-4 shrink-0 text-rose-600' />
                )}
                <div className='space-y-1'>
                  <p className='line-clamp-2'>
                    {i + 1}. {item.stem}
                  </p>
                  <p className='flex gap-4 text-xs text-muted-foreground'>
                    <span>你的答案：{item.selected.join('') || '未作答'}</span>
                    <span>正确答案：{item.answer.join('')}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className='justify-center gap-2'>
          <Button variant='outline' onClick={onExit}>
            返回题库
          </Button>
          <Button onClick={onRestart} disabled={restarting}>
            {restarting ? <Loader2 className='animate-spin' /> : <RotateCcw />}
            再练一次
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const answeredCount = Object.keys(results).length

  return (
    <Card className='mx-auto w-full max-w-3xl'>
      <CardHeader>
        <div className='flex items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={onExit}>
            <ArrowLeft />
            退出练习
          </Button>
          <span className='text-sm text-muted-foreground'>
            {session.set.name} · 第 {index + 1}/{questions.length} 题
          </span>
        </div>
        <SimpleProgress value={((index + 1) / questions.length) * 100} />
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary'>{q.type}</Badge>
        </div>
        <p className='leading-relaxed font-medium'>{q.stem}</p>

        {q.presentation && (
          <p
            className='rounded-md border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground'
            lang='en'
          >
            {q.presentation}
          </p>
        )}

        {q.images.length > 0 && (
          <div
            className={cn(
              'grid gap-2',
              q.images.length > 1 ? 'sm:grid-cols-2' : 'sm:max-w-md'
            )}
          >
            {q.images.map((img, i) => {
              // 图注常直接写出诊断，提交后才由后端返回
              const caption = result?.images[i]?.caption
              return (
                <figure key={img.url} className='space-y-1'>
                  <div className='flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-black'>
                    <img
                      src={img.url}
                      alt={`病例影像 ${i + 1}`}
                      className='max-h-full max-w-full object-contain'
                    />
                  </div>
                  {caption && (
                    <figcaption
                      className='text-xs leading-relaxed text-muted-foreground'
                      lang='en'
                    >
                      {caption}
                    </figcaption>
                  )}
                </figure>
              )
            })}
          </div>
        )}

        <div className='space-y-2'>
          {q.options.map((opt) => {
            const selected = (result?.selected ?? current).includes(opt.key)
            const right = result?.answer.includes(opt.key) ?? false
            return (
              <button
                key={opt.key}
                type='button'
                onClick={() => toggle(opt.key)}
                disabled={isSubmitted || submit.isPending}
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

        {result && (
          <div
            className={cn(
              'space-y-1 rounded-md border p-4 text-sm',
              result.correct
                ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/40'
                : 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/40'
            )}
          >
            <p className='flex items-center gap-1 font-semibold'>
              {result.correct ? (
                <>
                  <CircleCheck className='size-4 text-emerald-600' /> 回答正确
                </>
              ) : (
                <>
                  <CircleX className='size-4 text-rose-600' />{' '}
                  回答错误，正确答案：
                  {result.answer.join('')}
                </>
              )}
            </p>
            <p className='flex gap-1 text-muted-foreground'>
              <Lightbulb className='mt-0.5 size-4 shrink-0 text-amber-500' />
              {result.explanation}
            </p>
            {result.caseId && (
              <Button variant='link' size='sm' className='h-auto px-0' asChild>
                <Link to='/cases' search={{ case: result.caseId }}>
                  <FolderHeart />
                  查看完整病例 {result.caseId}
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className='justify-between'>
        <Button
          variant='outline'
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        >
          <ArrowLeft />
          上一题
        </Button>
        {!isSubmitted ? (
          <Button
            disabled={current.length === 0 || submit.isPending}
            onClick={submitAnswer}
          >
            {submit.isPending && <Loader2 className='animate-spin' />}
            提交答案
          </Button>
        ) : index < questions.length - 1 ? (
          <Button onClick={() => goTo(index + 1)}>
            下一题
            <ArrowRight />
          </Button>
        ) : (
          <Button
            disabled={finish.isPending}
            onClick={() => finish.mutate(undefined, { onSuccess: setSummary })}
          >
            {finish.isPending && <Loader2 className='animate-spin' />}
            查看成绩
            {answeredCount < questions.length &&
              `（${questions.length - answeredCount} 题未答）`}
          </Button>
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
