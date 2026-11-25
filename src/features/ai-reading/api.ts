import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { type Agreement, type AiReading, type AiSample } from './data/samples'

export function useAiSamples() {
  return useQuery({
    queryKey: ['ai-samples'],
    queryFn: async () =>
      (
        await api.get<{ modalities: string[]; samples: AiSample[] }>(
          '/ai/samples'
        )
      ).data,
    staleTime: Infinity,
  })
}

export function useAiReadings(page: number, pageSize = 10) {
  return useQuery({
    queryKey: ['ai-readings', page, pageSize],
    queryFn: async () =>
      (
        await api.get<{ items: AiReading[]; total: number }>('/ai/readings', {
          params: { page, pageSize },
        })
      ).data,
  })
}

export type ReadingInput = {
  /** 示例影像与上传图片二选一 */
  sampleId?: string
  file?: File
  modality: string
  opinion: string
}

export function useCreateReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReadingInput) => {
      const form = new FormData()
      if (input.sampleId) form.append('sampleId', input.sampleId)
      if (input.file) form.append('file', input.file)
      form.append('modality', input.modality)
      form.append('opinion', input.opinion)
      return (await api.post<AiReading>('/ai/readings', form)).data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-readings'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSetAgreement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      agreement,
    }: {
      id: string
      agreement: Agreement
    }) =>
      (await api.patch<AiReading>(`/ai/readings/${id}`, { agreement })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-readings'] })
    },
  })
}
