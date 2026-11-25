import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  formatRelativeTime,
  type RecentActivity,
} from '@/features/learning-stats/api'

export function RecentActivities({ items }: { items: RecentActivity[] }) {
  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>暂无学习动态。</p>
  }
  return (
    <div className='space-y-6'>
      {items.map((a, i) => (
        <div key={`${a.time}-${i}`} className='flex items-center gap-4'>
          <Avatar className='h-9 w-9'>
            <AvatarFallback>{a.name.slice(-1)}</AvatarFallback>
          </Avatar>
          <div className='flex flex-1 flex-wrap items-center justify-between gap-1'>
            <div className='space-y-1'>
              <p className='text-sm leading-none font-medium'>
                {a.name} <span className='font-normal'>{a.action}</span>
              </p>
              {a.detail && (
                <p className='text-sm text-muted-foreground'>{a.detail}</p>
              )}
            </div>
            <div className='text-xs text-muted-foreground'>
              {formatRelativeTime(a.time)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
