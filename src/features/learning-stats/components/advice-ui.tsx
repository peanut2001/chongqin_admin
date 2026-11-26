import { useEffect, useState, type ReactNode } from 'react'
import { type LucideIcon, RefreshCw, Sparkles } from 'lucide-react'
import { apiErrorTitle } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/** AI 图标：渐变色块 + Sparkles，用于按钮与标题 */
export function AiMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-sm',
        className
      )}
    >
      <Sparkles className='size-4' />
    </span>
  )
}

/** 模型分析通常要十几秒到几十秒：显示已等待的秒数，避免以为卡住了 */
export function AdviceLoading({ lines = 6 }: { lines?: number }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Sparkles className='size-4 animate-pulse text-violet-500' />
        AI 正在分析学情数据…
        <span className='tabular-nums'>{seconds}s</span>
      </div>
      <div className='space-y-2.5'>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            className='h-4'
            style={{ width: `${[92, 78, 85, 64, 88, 70][i % 6]}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function AdviceError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center'>
      <p className='text-sm text-destructive'>
        {apiErrorTitle(error, 'AI 分析失败，请稍后重试。')}
      </p>
      <Button variant='outline' size='sm' onClick={onRetry}>
        <RefreshCw className='size-3.5' />
        重试
      </Button>
    </div>
  )
}

/** 重新生成失败时保留旧结果，只在上方提示 */
export function RefreshError({ error }: { error: unknown }) {
  return (
    <p className='rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive'>
      重新生成失败：{apiErrorTitle(error, '请稍后重试。')}以下为上次的分析结果。
    </p>
  )
}

export function AdviceSection({
  icon: Icon,
  title,
  tone = 'default',
  children,
}: {
  icon: LucideIcon
  title: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
  children: ReactNode
}) {
  const toneClass = {
    default: 'text-primary',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
  }[tone]
  return (
    <section className='space-y-2'>
      <h4 className='flex items-center gap-1.5 text-sm font-semibold'>
        <Icon className={cn('size-4', toneClass)} />
        {title}
      </h4>
      {children}
    </section>
  )
}

/** 要点列表；空列表时显示占位文字 */
export function BulletList({
  items,
  empty = '暂无',
  ordered = false,
}: {
  items: string[]
  empty?: string
  ordered?: boolean
}) {
  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>{empty}</p>
  }
  return (
    <ul className='space-y-1.5 text-sm leading-relaxed'>
      {items.map((s, i) => (
        <li key={i} className='flex gap-2'>
          {ordered ? (
            <span className='mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary'>
              {i + 1}
            </span>
          ) : (
            <span className='mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50' />
          )}
          <span>{s}</span>
        </li>
      ))}
    </ul>
  )
}

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

/** 结果底部：来源说明、生成时间、重新生成 */
export function AdviceFooter({
  isDemo,
  disclaimer,
  generatedAt,
  refreshing,
  onRefresh,
}: {
  isDemo: boolean
  disclaimer: string
  generatedAt: string
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground'>
      <span className='flex min-w-0 items-center gap-1.5'>
        {isDemo && (
          <Badge variant='outline' className='shrink-0 font-normal'>
            演示
          </Badge>
        )}
        <span>{disclaimer}</span>
      </span>
      <span className='flex items-center gap-2'>
        {timeFmt.format(new Date(generatedAt))} 生成
        <Button
          variant='ghost'
          size='sm'
          className='h-7 px-2'
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          重新生成
        </Button>
      </span>
    </div>
  )
}
