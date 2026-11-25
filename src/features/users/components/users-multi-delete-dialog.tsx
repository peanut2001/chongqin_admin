'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useBulkUsers } from '../api'
import { reportBulkResult } from '../bulk-result'
import { type User } from '../data/schema'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'DELETE'

export function UsersMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')
  const bulk = useBulkUsers()

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(`请输入“${CONFIRM_WORD}”以确认。`)
      return
    }

    // 自己与最后一个管理员会被后端跳过，并在结果提示中说明
    const ids = selectedRows.map((row) => (row.original as User).id)
    bulk.mutate(
      { action: 'delete', ids },
      {
        onSuccess: (result) => {
          onOpenChange(false)
          setValue('')
          table.resetRowSelection()
          reportBulkResult(result, '删除')
        },
      }
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD}
      isLoading={bulk.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除 {selectedRows.length} 个用户
        </span>
      }
      desc={
        <form
          id='users-multi-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            确定要删除所选用户吗？
            <br />
            用户的练习、浏览、判读记录会一并删除，学情统计也会随之变化。如只是暂停使用，建议改为「停用」。
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span className=''>输入“{CONFIRM_WORD}”以确认：</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`输入“${CONFIRM_WORD}”以确认。`}
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>警告！</AlertTitle>
            <AlertDescription>请谨慎操作，此操作无法回滚。</AlertDescription>
          </Alert>
        </form>
      }
      confirmText='删除'
      destructive
    />
  )
}
