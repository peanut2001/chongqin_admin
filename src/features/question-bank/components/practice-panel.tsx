import { type ReactNode, useRef, useState } from 'react'
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
      <PracticeResult
        session={session}
        summary={summary}
        onExit={onExit}
        onRestart={onRestart}
        restarting={restarting}
      />
    )
  }

  const answeredCount = Object.keys(results).length
  // 有病例资料（原文或影像）的题用左右两栏：左侧资料、右侧作答，大屏上不用上下滚动
  const hasMaterial = (x: typeof q) => !!x.presentation || x.images.length > 0
  const wide = questions.some(hasMaterial)
  const split = hasMaterial(q)

  const material = split && (
    <div className='space-y-3'>
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
            q.images.length > 1 ? 'sm:grid-cols-2' : 'sm:max-w-md lg:max-w-none'
          )}
        >
          {q.images.map((img, i) => {
            // 图注常直接写出诊断，提交后才由后端返回
            const caption = result?.images[i]?.caption
            return (
              <figure key={img.url} className='space-y-1'>
                <div className='flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-black lg:aspect-auto lg:h-[clamp(240px,40vh,460px)]'>
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
    </div>
  )

  const answering = (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Badge variant='secondary'>{q.type}</Badge>
        <p className='leading-relaxed font-medium'>{q.stem}</p>
      </div>

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
                {q.type === '判断题' ? (opt.key === 'T' ? '√' : '×') : opt.key}
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

      {/* 翻页按钮紧跟选项，不用滚到卡片底部 */}
      <div className='flex justify-between gap-2 border-t pt-4'>
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
      </div>
    </div>
  )

  return (
    <Card className={cn('mx-auto w-full', !wide && 'max-w-3xl')}>
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

      <CardContent>
        {split ? (
          <div className='grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]'>
            {material}
            {/* 右栏随页面滚动时固定在顶部，选项和按钮始终可见 */}
            <div className='lg:sticky lg:top-20 lg:self-start'>{answering}</div>
          </div>
        ) : (
          answering
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 成绩页：顶部成绩，中间答题卡（每题一小格，绿对红错，点格子在下方看该题详情），底部按钮。
 * 整体限制在当前窗口内。
 */
function PracticeResult({
  session,
  summary,
  onExit,
  onRestart,
  restarting,
}: {
  session: PracticeSession
  summary: FinishResult
  onExit: () => void
  onRestart: () => void
  restarting?: boolean
}) {
  const { items } = summary
  // 默认展示第一道错题
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      items.findIndex((it) => !it.correct)
    )
  )
  const item = items[active] as FinishResult['items'][number] | undefined
  const question = session.questions.find((x) => x.id === item?.questionId)
  const wrong = items.filter((it) => !it.correct).length

  // 选项 key → 「C 先天性心脏病」（判断题直接显示 √ / ×）
  const optionText = (keys: string[]) =>
    keys
      .map((k) => {
        const text = question?.options.find((o) => o.key === k)?.text
        return k === 'T' || k === 'F' ? (text ?? k) : `${k} ${text ?? ''}`
      })
      .join('；')
  const letters = (keys: string[]) =>
    keys.map((k) => (k === 'T' ? '√' : k === 'F' ? '×' : k)).join('')

  return (
    <Card className='mx-auto flex max-h-[calc(100svh-8rem)] w-full max-w-4xl flex-col'>
      <CardHeader className='flex flex-wrap items-center gap-x-6 gap-y-3'>
        <div className='flex items-center gap-3'>
          <Trophy className='size-10 shrink-0 text-amber-500' />
          <div>
            <CardTitle className='text-xl'>练习完成</CardTitle>
            <CardDescription>{session.set.name}</CardDescription>
          </div>
        </div>
        <div className='grid flex-1 grid-cols-3 gap-3 text-center sm:ms-auto sm:max-w-md'>
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
      </CardHeader>

      <CardContent className='min-h-0 flex-1 space-y-4 overflow-y-auto'>
        <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
          <span className='font-medium'>
            答题卡
            {wrong > 0 && (
              <span className='ms-1 font-normal text-muted-foreground'>
                （错 {wrong} 题，点击格子查看详情）
              </span>
            )}
          </span>
          <span className='flex items-center gap-3 text-xs text-muted-foreground'>
            <Legend className='border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'>
              答对
            </Legend>
            <Legend className='border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950'>
              答错
            </Legend>
            <Legend className='bg-muted'>未作答</Legend>
          </span>
        </div>

        <div className='grid grid-cols-5 gap-2 sm:grid-cols-10'>
          {items.map((it, i) => {
            const answered = it.selected.length > 0
            return (
              <button
                key={it.questionId}
                type='button'
                aria-pressed={i === active}
                aria-label={`第 ${i + 1} 题，${it.correct ? '答对' : answered ? '答错' : '未作答'}`}
                onClick={() => setActive(i)}
                className={cn(
                  'flex flex-col items-center rounded-md border py-1.5 transition hover:-translate-y-0.5 hover:shadow-sm',
                  it.correct
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : answered
                      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-muted text-muted-foreground',
                  i === active && 'ring-2 ring-primary ring-offset-1'
                )}
              >
                <span className='text-sm font-semibold tabular-nums'>
                  {i + 1}
                </span>
                <span className='text-xs'>
                  {answered ? (
                    it.correct ? (
                      letters(it.selected)
                    ) : (
                      <>
                        <s className='opacity-70'>{letters(it.selected)}</s>
                        <span className='ms-0.5 font-semibold text-emerald-600 dark:text-emerald-400'>
                          {letters(it.answer)}
                        </span>
                      </>
                    )
                  ) : (
                    '—'
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {item && (
          <div className='space-y-1.5 rounded-md border p-4 text-sm'>
            <p className='flex items-center gap-1.5 font-medium'>
              {item.correct ? (
                <CircleCheck className='size-4 text-emerald-600' />
              ) : (
                <CircleX className='size-4 text-rose-600' />
              )}
              第 {active + 1} 题
              {question && (
                <Badge variant='secondary' className='font-normal'>
                  {question.type}
                </Badge>
              )}
            </p>
            <p className='text-muted-foreground'>{item.stem}</p>
            <p>
              你的答案：
              {item.selected.length ? optionText(item.selected) : '未作答'}
            </p>
            {!item.correct && (
              <p className='text-emerald-700 dark:text-emerald-400'>
                正确答案：{optionText(item.answer)}
              </p>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className='justify-center gap-2 border-t'>
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

function Legend({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span className='flex items-center gap-1'>
      <span className={cn('size-3 rounded-sm border', className)} />
      {children}
    </span>
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
