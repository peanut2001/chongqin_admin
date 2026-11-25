/**
 * 角色与权限（前端 mock 版）
 *
 * 注意：前端权限只控制界面显示，接入后端后必须由接口再做一次校验。
 */

export const ROLES = ['admin', 'teacher', 'student'] as const
export type Role = (typeof ROLES)[number]

export const roleLabels: Record<Role, string> = {
  admin: '管理员',
  teacher: '教师',
  student: '学生',
}

/** 各角色的默认头像（用户没有上传头像时显示），文件在 public/avatars */
export const roleDefaultAvatars: Record<Role, string> = {
  admin: '/avatars/admin.gif',
  teacher: '/avatars/teacher.gif',
  student: '/avatars/student.gif',
}

/**
 * 路由访问规则：按路径前缀匹配。
 * 未列出的路由，所有已登录用户都可以访问。
 */
const routeRules: { prefix: string; roles: Role[] }[] = [
  { prefix: '/users', roles: ['admin'] },
  { prefix: '/classes', roles: ['admin'] },
  { prefix: '/semesters', roles: ['admin'] },
  { prefix: '/learning-stats', roles: ['admin', 'teacher'] },
  // 模板自带的示例页面，暂不对任何角色开放（菜单中也已隐藏）
  { prefix: '/tasks', roles: [] },
  { prefix: '/apps', roles: [] },
  { prefix: '/chats', roles: [] },
  { prefix: '/help-center', roles: [] },
]

/** 能否查看班级/其他学生的学习数据（与学情统计页权限一致） */
export function canViewClassData(role: Role | undefined): boolean {
  return canAccess(role, '/learning-stats')
}

/** 判断某角色能否访问某路径（可传入带查询参数的完整 href） */
export function canAccess(
  role: Role | undefined,
  path: string | undefined
): boolean {
  if (!role) return false
  const pathname = (path ?? '').split(/[?#]/)[0]
  const rule = routeRules.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  return !rule || rule.roles.includes(role)
}
