import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { recentActivities } from '@/features/learning-stats/data/stats'

export function RecentActivities() {
  return (
    <div className='space-y-6'>
      {recentActivities.map((a) => (
        <div key={`${a.name}-${a.time}`} className='flex items-center gap-4'>
          <Avatar className='h-9 w-9'>
            <AvatarFallback>{a.name.slice(-1)}</AvatarFallback>
          </Avatar>
          <div className='flex flex-1 flex-wrap items-center justify-between gap-1'>
            <div className='space-y-1'>
              <p className='text-sm leading-none font-medium'>
                {a.name} <span className='font-normal'>{a.action}</span>
              </p>
              <p className='text-sm text-muted-foreground'>{a.detail}</p>
            </div>
            <div className='text-xs text-muted-foreground'>{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
