import { createFileRoute } from '@tanstack/react-router'
import { QuestionBank } from '@/features/question-bank'

export const Route = createFileRoute('/_authenticated/question-bank/')({
  component: QuestionBank,
})
