import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { sleep } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User } from '../data/schema'
import { useUsersStore } from '../data/users-store'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const setStatus = useUsersStore((s) => s.setStatus)
  const currentUserId = useAuthStore((s) => s.auth.user?.id)

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    let ids = selectedRows.map((row) => (row.original as User).id)
    // 不允许把当前登录的自己设为未激活
    if (status === 'inactive' && ids.includes(currentUserId ?? '')) {
      ids = ids.filter((id) => id !== currentUserId)
      toast.warning('已跳过当前登录账号，不能停用自己。')
    }
    setStatus(ids, status)
    table.resetRowSelection()
    toast.success(
      `已${status === 'active' ? '激活' : '取消激活'} ${ids.length} 个用户`
    )
  }

  const handleBulkInvite = () => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading: '正在邀请用户…',
      success: () => {
        table.resetRowSelection()
        return `已邀请 ${selectedUsers.length} 个用户`
      },
      error: '邀请用户时出错',
    })
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='用户'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={handleBulkInvite}
              className='size-8'
              aria-label='邀请所选用户'
              title='邀请所选用户'
            >
              <Mail />
              <span className='sr-only'>邀请所选用户</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>邀请所选用户</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('active')}
              className='size-8'
              aria-label='激活所选用户'
              title='激活所选用户'
            >
              <UserCheck />
              <span className='sr-only'>激活所选用户</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>激活所选用户</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('inactive')}
              className='size-8'
              aria-label='取消激活所选用户'
              title='取消激活所选用户'
            >
              <UserX />
              <span className='sr-only'>取消激活所选用户</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>取消激活所选用户</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='删除所选用户'
              title='删除所选用户'
            >
              <Trash2 />
              <span className='sr-only'>删除所选用户</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除所选用户</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
