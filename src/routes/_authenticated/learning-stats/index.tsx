import { createFileRoute } from '@tanstack/react-router'
import { LearningStats } from '@/features/learning-stats'

export const Route = createFileRoute('/_authenticated/learning-stats/')({
  component: LearningStats,
})
