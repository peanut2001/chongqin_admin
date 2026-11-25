import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import {
  type AnswerResult,
  type FinishResult,
  type PracticeRecord,
  type PracticeSession,
  type QuestionSet,
} from './data/questions'

export function useQuestionSets() {
  return useQuery({
    queryKey: ['question-sets'],
    queryFn: async () => (await api.get<QuestionSet[]>('/question-sets')).data,
  })
}

export function usePracticeRecords(page: number, pageSize = 10) {
  return useQuery({
    queryKey: ['practice-records', page, pageSize],
    queryFn: async () =>
      (
        await api.get<{ items: PracticeRecord[]; total: number }>(
          '/practice-sessions',
          { params: { page, pageSize } }
        )
      ).data,
  })
}

/** 开始练习：服务端抽题并固定本次练习的题目 */
export function useStartPractice() {
  return useMutation({
    mutationFn: async (setId: string) =>
      (await api.post<PracticeSession>('/practice-sessions', { setId })).data,
  })
}

export function useSubmitAnswer(sessionId: string) {
  return useMutation({
    mutationFn: async (input: {
      questionId: string
      selected: string[]
      timeSpentMs: number
    }) =>
      (
        await api.post<AnswerResult>(
          `/practice-sessions/${sessionId}/answers`,
          input
        )
      ).data,
  })
}

export function useFinishPractice(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await api.post<FinishResult>(`/practice-sessions/${sessionId}/finish`))
        .data,
    // 成绩会影响题集正确率、练习记录与学情统计
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['question-sets'] })
      void qc.invalidateQueries({ queryKey: ['practice-records'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
