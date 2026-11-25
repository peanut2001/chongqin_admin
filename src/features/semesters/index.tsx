import { useState } from 'react'
import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import {
  type SemesterRow,
  useActivateSemester,
  useDeleteSemester,
  useSemesters,
} from './api'
import { SemesterDialog } from './components/semester-dialog'

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; row: SemesterRow }
  | { type: 'delete'; row: SemesterRow }
  | { type: 'activate'; row: SemesterRow }
  | null

export function Semesters() {
  const { data, isLoading, isError } = useSemesters()
  const [dialog, setDialog] = useState<DialogState>(null)
  const remove = useDeleteSemester()
  const activate = useActivateSemester()

  const deleting = dialog?.type === 'delete' ? dialog.row : undefined
  const activating = dialog?.type === 'activate' ? dialog.row : undefined
  const hasCurrent = (data ?? []).some((s) => s.isCurrent)

  const confirmDelete = () => {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`已删除学期「${deleting.name}」`)
        setDialog(null)
      },
    })
  }

  const confirmActivate = () => {
    if (!activating) return
    activate.mutate(activating.id, {
      onSuccess: () => {
        toast.success(`当前学期已切换为「${activating.name}」`)
        setDialog(null)
      },
    })
  }

  return (
    <>
      <DefaultHeader />

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>学期管理</h2>
            <p className='text-muted-foreground'>
              当前学期决定仪表盘与学情统计的统计范围和教学周。
            </p>
          </div>
          <Button onClick={() => setDialog({ type: 'create' })}>
            <Plus />
            新建学期
          </Button>
        </div>

        {!isLoading && !isError && !hasCurrent && (
          <Alert variant='destructive'>
            <AlertDescription>
              还没有当前学期，仪表盘和学情统计暂时无法使用。请新建一个学期。
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学期名称</TableHead>
                  <TableHead>课程</TableHead>
                  <TableHead>起止日期</TableHead>
                  <TableHead className='text-end'>教学周</TableHead>
                  <TableHead className='w-36 text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className='font-medium'>
                      <span className='flex items-center gap-2'>
                        {s.name}
                        {s.isCurrent && <Badge>当前学期</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{s.course}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {s.startDate} 至 {s.endDate}
                    </TableCell>
                    <TableCell className='text-end'>
                      {s.isCurrent
                        ? `第 ${s.currentWeek} / ${s.totalWeeks} 周`
                        : `${s.totalWeeks} 周`}
                    </TableCell>
                    <TableCell className='text-end'>
                      {!s.isCurrent && (
                        <Button
                          variant='ghost'
                          size='icon'
                          aria-label={`将 ${s.name} 设为当前学期`}
                          title='设为当前学期'
                          onClick={() =>
                            setDialog({ type: 'activate', row: s })
                          }
                        >
                          <CalendarCheck />
                        </Button>
                      )}
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={`编辑 ${s.name}`}
                        onClick={() => setDialog({ type: 'edit', row: s })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='text-destructive'
                        aria-label={`删除 ${s.name}`}
                        title={
                          s.isCurrent
                            ? '当前学期不能删除，请先把其他学期设为当前学期'
                            : undefined
                        }
                        disabled={s.isCurrent}
                        onClick={() => setDialog({ type: 'delete', row: s })}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-20 text-center text-muted-foreground'
                    >
                      {isError ? '学期列表加载失败。' : '还没有学期。'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>

      <SemesterDialog
        open={dialog?.type === 'create' || dialog?.type === 'edit'}
        onOpenChange={(open) => !open && setDialog(null)}
        current={dialog?.type === 'edit' ? dialog.row : undefined}
        defaultCourse={data?.[0]?.course}
      />

      <ConfirmDialog
        open={!!activating}
        onOpenChange={(open) => !open && setDialog(null)}
        title='切换当前学期'
        desc={`确定把「${activating?.name ?? ''}」设为当前学期吗？仪表盘和学情统计将改为统计该学期的数据（已有学习记录不会删除）。`}
        confirmText='设为当前学期'
        isLoading={activate.isPending}
        handleConfirm={confirmActivate}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDialog(null)}
        title='删除学期'
        desc={`确定删除学期「${deleting?.name ?? ''}」吗？只删除学期设置，不会删除学生的学习记录。`}
        confirmText='删除'
        destructive
        isLoading={remove.isPending}
        handleConfirm={confirmDelete}
      />
    </>
  )
}
