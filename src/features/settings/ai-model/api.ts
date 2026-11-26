import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type AiProvider = 'anthropic' | 'openai'

/** 后端 /api/settings/ai-model 返回的配置（不含 API Key） */
export type AiModelConfig = {
  provider: AiProvider
  baseUrl: string
  model: string
  enabled: boolean
  hasApiKey: boolean
  /** 已保存 Key 的末 4 位提示，如 ••••abcd */
  apiKeyHint: string | null
  updatedAt: string | null
}

export type AiModelInput = {
  provider: AiProvider
  baseUrl: string
  /** 留空表示沿用已保存的 Key */
  apiKey: string
  model: string
  enabled: boolean
}

export type ModelOption = { id: string; name: string }

const key = ['settings', 'ai-model'] as const

export function useAiModelConfig() {
  return useQuery({
    queryKey: key,
    queryFn: async () =>
      (await api.get<AiModelConfig>('/settings/ai-model')).data,
  })
}

export function useSaveAiModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AiModelInput) =>
      (await api.put<AiModelConfig>('/settings/ai-model', input)).data,
    onSuccess: (cfg) => {
      qc.setQueryData(key, cfg)
      // AI 判读页的「当前判读引擎」随之变化
      void qc.invalidateQueries({ queryKey: ['ai-samples'] })
    },
    meta: { silent: true },
  })
}

export function useFetchModels() {
  return useMutation({
    mutationFn: async (input: Omit<AiModelInput, 'model' | 'enabled'>) =>
      (
        await api.post<{ models: ModelOption[] }>(
          '/settings/ai-model/models',
          input
        )
      ).data.models,
    meta: { silent: true },
  })
}
