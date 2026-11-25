import { Shield, Presentation, GraduationCap } from 'lucide-react'
import { roleLabels } from '@/lib/permissions'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
  [
    'suspended',
    'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  ],
])

export const statuses = [
  { label: '活跃', value: 'active' },
  { label: '未激活', value: 'inactive' },
  { label: '已邀请', value: 'invited' },
  { label: '已停用', value: 'suspended' },
] as const

export const roles = [
  { label: roleLabels.admin, value: 'admin', icon: Shield },
  { label: roleLabels.teacher, value: 'teacher', icon: Presentation },
  { label: roleLabels.student, value: 'student', icon: GraduationCap },
] as const
