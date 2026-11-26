import { createFileRoute } from '@tanstack/react-router'
import { SettingsAiModel } from '@/features/settings/ai-model'

export const Route = createFileRoute('/_authenticated/settings/ai-model')({
  component: SettingsAiModel,
})
