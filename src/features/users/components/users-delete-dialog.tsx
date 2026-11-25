'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDeleteUser } from '../api'
import { roles } from '../data/data'
import { type User } from '../data/schema'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeleteDialogProps) {
  const [value, setValue] = useState('')
  const deleteUser = useDeleteUser()

  const handleDelete = () => {
    if (value.trim() !== currentRow.username) return

    deleteUser.mutate(currentRow.id, {
      onSuccess: () => {
        onOpenChange(false)
        toast.success(`已删除用户 ${currentRow.username}`)
      },
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-delete-form'
      disabled={value.trim() !== currentRow.username}
      isLoading={deleteUser.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除用户
        </span>
      }
      desc={
        <form
          id='users-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            确定要删除 <span className='font-bold'>{currentRow.username}</span>{' '}
            吗？
            <br />
            此操作将从系统中永久移除角色为{' '}
            <span className='font-bold'>
              {roles.find(({ value }) => value === currentRow.role)?.label ??
                currentRow.role}
            </span>{' '}
            的该用户，其练习、浏览、判读记录会一并删除，且无法撤销。如只是暂停使用，建议改为「停用」。
          </p>

          <Label className='my-2'>
            用户名：
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='输入用户名以确认删除。'
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
