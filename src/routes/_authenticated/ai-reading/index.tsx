import { createFileRoute } from '@tanstack/react-router'
import { AiReading } from '@/features/ai-reading'

export const Route = createFileRoute('/_authenticated/ai-reading/')({
  component: AiReading,
})
