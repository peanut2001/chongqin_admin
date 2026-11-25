import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Cases } from '@/features/cases'

const searchSchema = z.object({
  /** 当前打开的病例编号，如 BL-0305（可从题库「查看完整病例」跳转） */
  case: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/cases/')({
  validateSearch: searchSchema,
  component: Cases,
})
