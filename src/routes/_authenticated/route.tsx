import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureSession } from '@/lib/api/auth'
import { canAccess } from '@/lib/permissions'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // 内存中没有 token（如刷新页面）时，用 httpOnly refresh cookie 恢复会话
    const user = await ensureSession()

    if (!user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    // 前端只控制页面可见性；真正的权限由后端接口校验
    if (!canAccess(user.role, location.pathname)) {
      throw redirect({ to: '/403' })
    }
  },
  component: AuthenticatedLayout,
})
