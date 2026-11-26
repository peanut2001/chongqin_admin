import { ClipboardList, FolderHeart, ScanEye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  formatRelativeTime,
  type RecentActivity,
} from '@/features/learning-stats/api'

/** 按后端 action 文案区分动态类型，颜色与「学习活跃度」图表保持一致 */
function kindOf(action: string) {
  if (action.startsWith('浏览病例')) {
    return { icon: FolderHeart, color: 'var(--chart-1)' }
  }
  if (action.startsWith('完成')) {
    return { icon: ClipboardList, color: 'var(--chart-2)' }
  }
  return { icon: ScanEye, color: 'var(--chart-3)' }
}

function ActivityRow({ a, index }: { a: RecentActivity; index: number }) {
  const kind = kindOf(a.action)
  return (
    <div
      className='flex animate-in items-center gap-3 rounded-lg px-2 py-2 transition-colors fill-mode-both fade-in slide-in-from-right-4 hover:bg-muted/60'
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className='relative shrink-0'>
        <Avatar className='size-9'>
          <AvatarFallback>{a.name.slice(-1)}</AvatarFallback>
        </Avatar>
        <span
          className='absolute -end-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full text-white ring-2 ring-card'
          style={{ background: kind.color }}
        >
          <kind.icon className='size-2.5' />
        </span>
      </div>
      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex items-baseline justify-between gap-2'>
          <p className='truncate text-sm font-medium'>
            {a.name} <span className='font-normal'>{a.action}</span>
          </p>
          <span className='shrink-0 text-xs text-muted-foreground'>
            {formatRelativeTime(a.time)}
          </span>
        </div>
        {a.detail && (
          <p className='truncate text-xs text-muted-foreground'>{a.detail}</p>
        )}
      </div>
    </div>
  )
}

/** 少于该条数时不滚动 */
const MARQUEE_MIN = 5

/**
 * 最近学习动态。autoScroll 时在固定高度内自动向上轮播（悬停暂停），
 * 系统开启「减少动态效果」时改为普通滚动列表（见 index.css 的 .marquee）。
 */
export function RecentActivities({
  items,
  autoScroll = false,
  className,
}: {
  items: RecentActivity[]
  autoScroll?: boolean
  className?: string
}) {
  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>暂无学习动态。</p>
  }
  const list = (dup: boolean) => (
    <div
      className={cn('space-y-1 pb-1', dup && 'marquee-dup')}
      aria-hidden={dup}
    >
      {items.map((a, i) => (
        <ActivityRow key={`${a.time}-${a.name}-${a.action}`} a={a} index={i} />
      ))}
    </div>
  )
  if (!autoScroll || items.length < MARQUEE_MIN) {
    return <div className={cn('-mx-2', className)}>{list(false)}</div>
  }
  return (
    <div
      className={cn(
        'marquee -mx-2 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_94%,transparent)]',
        className
      )}
    >
      <div
        className='marquee-track'
        style={
          {
            '--marquee-duration': `${items.length * 3}s`,
          } as React.CSSProperties
        }
      >
        {list(false)}
        {list(true)}
      </div>
    </div>
  )
}
