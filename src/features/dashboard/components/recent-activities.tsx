import { ClipboardList, FolderHeart, ScanEye } from 'lucide-react'
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

export function RecentActivities({ items }: { items: RecentActivity[] }) {
  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>暂无学习动态。</p>
  }
  return (
    <div className='-mx-2 space-y-1'>
      {items.map((a, i) => {
        const kind = kindOf(a.action)
        return (
          <div
            key={`${a.time}-${a.name}-${a.action}`}
            className='flex animate-in items-center gap-4 rounded-lg px-2 py-2 transition-colors fill-mode-both fade-in slide-in-from-right-4 hover:bg-muted/60'
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className='relative'>
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
            <div className='flex min-w-0 flex-1 flex-wrap items-center justify-between gap-1'>
              <div className='min-w-0 space-y-1'>
                <p className='text-sm leading-none font-medium'>
                  {a.name} <span className='font-normal'>{a.action}</span>
                </p>
                {a.detail && (
                  <p className='truncate text-sm text-muted-foreground'>
                    {a.detail}
                  </p>
                )}
              </div>
              <div className='text-xs whitespace-nowrap text-muted-foreground'>
                {formatRelativeTime(a.time)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
