import { useAuthStore } from '@/stores/auth-store'
import { canAccess } from '@/lib/permissions'
import { sidebarData } from './data/sidebar-data'
import { type NavGroup, type NavItem } from './types'

/** 按当前登录用户的角色过滤菜单，没有可见项的分组整体隐藏 */
export function useNavGroups(): NavGroup[] {
  const role = useAuthStore((s) => s.auth.user?.role)

  return sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item): NavItem | null => {
          if (!item.items) return canAccess(role, item.url) ? item : null
          const items = item.items.filter((sub) => canAccess(role, sub.url))
          return items.length ? { ...item, items } : null
        })
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0)
}
