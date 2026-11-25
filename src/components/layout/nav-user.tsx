import { Link } from '@tanstack/react-router'
import { BadgeCheck, ChevronsUpDown, LogOut, UserCog } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { roleLabels } from '@/lib/permissions'
import useDialogState from '@/hooks/use-dialog-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { UserAvatar } from '@/components/user-avatar'

export function NavUser() {
  const { isMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  const authUser = useAuthStore((s) => s.auth.user)
  const name = authUser
    ? `${authUser.name}（${roleLabels[authUser.role]}）`
    : '未登录'
  const email = authUser?.email ?? ''

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                <UserAvatar
                  className='h-8 w-8 rounded-lg'
                  fallbackClassName='rounded-lg'
                />
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate font-semibold'>{name}</span>
                  <span className='truncate text-xs'>{email}</span>
                </div>
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <UserAvatar
                    className='h-8 w-8 rounded-lg'
                    fallbackClassName='rounded-lg'
                  />
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>{name}</span>
                    <span className='truncate text-xs'>{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='/settings'>
                    <UserCog />
                    个人资料
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/settings/account'>
                    <BadgeCheck />
                    账户
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setOpen(true)}
              >
                <LogOut />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
