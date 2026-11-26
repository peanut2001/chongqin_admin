import { ChevronRight, Lightbulb, TriangleAlert, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGroupAdvice } from '../api'
import {
  AdviceError,
  AdviceFooter,
  AdviceLoading,
  AdviceSection,
  AiMark,
  BulletList,
  RefreshError,
} from './advice-ui'

/** 群体 AI 学情分析：分析当前筛选范围内的学生 */
export function GroupAdviceDialog({
  open,
  onOpenChange,
  userIds,
  scopeLabel,
  onPickStudent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userIds: string[]
  /** 分析范围说明，如「全部学生」「需关注」 */
  scopeLabel: string
  /** 点击重点关注学生：打开该生详情 */
  onPickStudent: (userId: string) => void
}) {
  const q = useGroupAdvice(userIds, open)
  const data = q.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl'>
        <DialogHeader className='border-b p-5 pe-12'>
          <DialogTitle className='flex items-center gap-2'>
            <AiMark />
            AI 学情分析
          </DialogTitle>
          <DialogDescription>
            分析范围：{scopeLabel} · {userIds.length} 人
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 space-y-5 overflow-y-auto p-5'>
          {q.isPending ? (
            <AdviceLoading />
          ) : q.isError && !data ? (
            <AdviceError error={q.error} onRetry={() => q.refetch()} />
          ) : data ? (
            <div
              className={cn(
                'space-y-5 transition-opacity',
                q.isFetching && 'opacity-50'
              )}
            >
              {q.isError && <RefreshError error={q.error} />}
              <p className='rounded-lg bg-gradient-to-br from-violet-500/10 to-sky-500/10 p-4 text-sm leading-relaxed'>
                {data.summary}
              </p>

              <AdviceSection
                icon={TriangleAlert}
                title='主要问题'
                tone='warning'
              >
                <div className='grid gap-2 sm:grid-cols-2'>
                  {data.issues.map((it, i) => (
                    <div key={i} className='rounded-lg border p-3'>
                      <div className='text-sm font-medium'>{it.title}</div>
                      <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
                        {it.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </AdviceSection>

              <AdviceSection
                icon={UserRound}
                title='重点关注学生'
                tone='danger'
              >
                {data.focusStudents.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    暂无需要重点关注的学生。
                  </p>
                ) : (
                  <ul className='divide-y rounded-lg border'>
                    {data.focusStudents.map((s) => (
                      <li key={s.userId}>
                        <button
                          type='button'
                          className='group flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-muted/60'
                          onClick={() => onPickStudent(s.userId)}
                        >
                          <span className='w-28 shrink-0'>
                            <span className='block text-sm font-medium'>
                              {s.name}
                            </span>
                            <span className='block text-xs text-muted-foreground'>
                              {s.studentNo}
                            </span>
                          </span>
                          <span className='min-w-0 flex-1 text-sm text-muted-foreground'>
                            {s.reason}
                          </span>
                          <ChevronRight className='size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </AdviceSection>

              <AdviceSection icon={Lightbulb} title='教学建议' tone='success'>
                <BulletList items={data.suggestions} ordered />
              </AdviceSection>
            </div>
          ) : null}
        </div>

        {data && (
          <div className='px-5 pb-4'>
            <AdviceFooter
              isDemo={data.isDemo}
              disclaimer={data.disclaimer}
              generatedAt={data.generatedAt}
              refreshing={q.isFetching}
              onRefresh={() => q.refetch()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
