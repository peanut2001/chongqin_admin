import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { type SchoolClassRow, useClasses, useDeleteClass } from './api'
import { ClassDialog } from './components/class-dialog'

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; row: SchoolClassRow }
  | { type: 'delete'; row: SchoolClassRow }
  | null

export function Classes() {
  const { data, isLoading, isError } = useClasses()
  const [dialog, setDialog] = useState<DialogState>(null)
  const remove = useDeleteClass()

  const deleting = dialog?.type === 'delete' ? dialog.row : undefined

  const confirmDelete = () => {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`已删除班级「${deleting.name}」`)
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
            <h2 className='text-2xl font-bold tracking-tight'>班级管理</h2>
            <p className='text-muted-foreground'>
              维护班级信息；学生所属班级在用户管理中设置。
            </p>
          </div>
          <Button onClick={() => setDialog({ type: 'create' })}>
            <Plus />
            新建班级
          </Button>
        </div>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>班级名称</TableHead>
                  <TableHead>入学年份</TableHead>
                  <TableHead className='text-end'>学生人数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className='w-24 text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className='font-medium'>
                      <span className='flex items-center gap-2'>
                        {c.name}
                        {c.isDemo && <Badge variant='outline'>演示</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{c.cohortYear ?? '—'}</TableCell>
                    <TableCell className='text-end'>{c.studentCount}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {dateFmt.format(new Date(c.createdAt))}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={`编辑 ${c.name}`}
                        onClick={() => setDialog({ type: 'edit', row: c })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='text-destructive'
                        aria-label={`删除 ${c.name}`}
                        title={
                          c.studentCount
                            ? '班级内还有学生，需先在用户管理中调整他们的班级'
                            : undefined
                        }
                        disabled={c.studentCount > 0}
                        onClick={() => setDialog({ type: 'delete', row: c })}
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
                      {isError ? '班级列表加载失败。' : '还没有班级。'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>

      <ClassDialog
        open={dialog?.type === 'create' || dialog?.type === 'edit'}
        onOpenChange={(open) => !open && setDialog(null)}
        current={dialog?.type === 'edit' ? dialog.row : undefined}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDialog(null)}
        title='删除班级'
        desc={`确定删除班级「${deleting?.name ?? ''}」吗？此操作无法撤销。`}
        confirmText='删除'
        destructive
        isLoading={remove.isPending}
        handleConfirm={confirmDelete}
      />
    </>
  )
}
