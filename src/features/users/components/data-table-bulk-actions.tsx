import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { useBulkUsers } from '../api'
import { reportBulkResult } from '../bulk-result'
import { type User } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const bulk = useBulkUsers()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    const ids = selectedRows.map((row) => (row.original as User).id)
    const verb = status === 'active' ? '激活' : '取消激活'
    bulk.mutate(
      { action: status === 'active' ? 'activate' : 'deactivate', ids },
      {
        onSuccess: (result) => {
          table.resetRowSelection()
          reportBulkResult(result, verb)
        },
      }
    )
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='用户'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              disabled={bulk.isPending}
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
              disabled={bulk.isPending}
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
