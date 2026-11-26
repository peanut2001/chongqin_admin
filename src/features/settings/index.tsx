import { Outlet } from '@tanstack/react-router'
import { Bot, Palette, Wrench, UserCog } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { canAccess } from '@/lib/permissions'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  {
    title: '个人资料',
    href: '/settings',
    icon: <UserCog size={18} />,
  },
  {
    title: '账户',
    href: '/settings/account',
    icon: <Wrench size={18} />,
  },
  {
    title: '外观',
    href: '/settings/appearance',
    icon: <Palette size={18} />,
  },
  {
    title: 'AI 模型',
    href: '/settings/ai-model',
    icon: <Bot size={18} />,
  },
]

export function Settings() {
  const role = useAuthStore((s) => s.auth.user?.role)
  const items = sidebarNavItems.filter((item) => canAccess(role, item.href))

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            设置
          </h1>
          <p className='text-muted-foreground'>
            {role === 'admin'
              ? '管理个人资料、登录密码、界面外观与 AI 判读模型。'
              : '管理个人资料、登录密码与界面外观。'}
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={items} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
