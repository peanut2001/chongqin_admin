import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { attachTopics, type CaseRecord, type DiseaseTopic } from './data/cases'

/** 病例列表（已关联病种） */
export function useMedicalCases() {
  const topics = useTopics()
  const records = useCaseRecords()
  const cases = useMemo(
    () =>
      records.data && topics.data
        ? attachTopics(records.data, topics.data)
        : [],
    [records.data, topics.data]
  )
  return {
    cases,
    topics: topics.data ?? [],
    isLoading: topics.isLoading || records.isLoading,
    isError: topics.isError || records.isError,
  }
}

function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: async () => (await api.get<DiseaseTopic[]>('/topics')).data,
    staleTime: 10 * 60 * 1000,
  })
}

function useCaseRecords() {
  return useQuery({
    queryKey: ['cases'],
    queryFn: async () => (await api.get<CaseRecord[]>('/cases')).data,
    staleTime: 10 * 60 * 1000,
  })
}

/** 病例详情（含英文全文），打开详情时才加载 */
export function useCaseFullText(caseId: string) {
  return useQuery({
    queryKey: ['case', caseId],
    queryFn: async () =>
      (await api.get<CaseRecord & { fullText: string }>(`/cases/${caseId}`))
        .data.fullText,
    staleTime: Infinity,
  })
}

/** 记录一次浏览（后端 30 分钟内同一病例只算一次） */
export function useRecordCaseView() {
  return useMutation({
    mutationFn: async (caseId: string) =>
      (await api.post<{ id: number }>(`/cases/${caseId}/views`)).data.id,
    meta: { silent: true },
  })
}

/** 关闭详情时上报停留时长 */
export function reportViewDuration(viewId: number, durationSeconds: number) {
  return api
    .patch(`/case-views/${viewId}`, { durationSeconds })
    .catch(() => undefined)
}
