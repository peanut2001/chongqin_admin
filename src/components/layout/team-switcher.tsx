import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

type TeamSwitcherProps = {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}

// 侧边栏顶部品牌栏：院徽 + 医院全称 + 平台名（仅一个机构，不再提供切换下拉）
export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const { setOpenMobile } = useSidebar()
  const team = teams[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          asChild
          className='h-14 gap-1.5 px-1 hover:bg-transparent active:bg-transparent'
        >
          <Link to='/' onClick={() => setOpenMobile(false)}>
            <team.logo className='h-9 w-12 shrink-0 group-data-[collapsible=icon]:w-10 dark:rounded-md dark:bg-white dark:p-0.5' />
            <div className='grid flex-1 gap-1 text-start leading-tight'>
              <span className='truncate text-[13px] font-bold tracking-tight'>
                {team.name}
              </span>
              <span className='truncate text-[11px] font-normal tracking-[0.2em] text-muted-foreground'>
                {team.plan}
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
