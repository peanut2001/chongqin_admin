import { cn } from '@/lib/utils'

type SimpleProgressProps = {
  /** 0 - 100 */
  value: number
  className?: string
  indicatorClassName?: string
}

/** 轻量进度条（不依赖额外 Radix 包） */
export function SimpleProgress({
  value,
  className,
  indicatorClassName,
}: SimpleProgressProps) {
  const percent = Math.min(100, Math.max(0, value))
  return (
    <div
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted',
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-all',
          indicatorClassName
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
