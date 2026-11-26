import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { LearningStats } from '@/features/learning-stats'

const searchSchema = z.object({
  // 班级筛选同步在地址栏，班级管理可直接跳转到某个班的学情
  classId: z.number().int().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/learning-stats/')({
  validateSearch: searchSchema,
  component: LearningStats,
})
