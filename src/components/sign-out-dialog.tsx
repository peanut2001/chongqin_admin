import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { logout } from '@/lib/api/auth'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const handleSignOut = async () => {
    // 先通知后端吊销 refresh token；即使请求失败，本地会话也会被清除
    await logout().catch(() => undefined)
    queryClient.clear()
    // Preserve current location for redirect after sign-in
    navigate({
      to: '/sign-in',
      search: { redirect: location.href },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='退出登录'
      desc='确定要退出登录吗？你需要重新登录才能访问你的账户。'
      confirmText='退出登录'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
