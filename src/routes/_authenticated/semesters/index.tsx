import { createFileRoute } from '@tanstack/react-router'
import { Semesters } from '@/features/semesters'

export const Route = createFileRoute('/_authenticated/semesters/')({
  component: Semesters,
})
