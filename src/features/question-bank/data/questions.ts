/**
 * 题库类型（与后端 /api/question-sets、/api/practice-sessions 一致）
 *
 * 判分在后端进行：开始练习时下发的题目不含答案、解析、图注与关联病例，
 * 每题提交后由 /answers 接口返回对错与解析。
 */

export type QuestionType = '单选题' | '多选题' | '判断题'

/** 练习中的题目（提交前可见的部分） */
export type Question = {
  id: string
  type: QuestionType
  stem: string
  options: { key: string; text: string }[]
  /** 病例题：病例原文节选（英文，已截去诊断部分） */
  presentation: string | null
  images: { url: string }[]
}

/** 提交一题后后端返回的结果 */
export type AnswerResult = {
  questionId: string
  selected: string[]
  correct: boolean
  answer: string[]
  explanation: string
  /** 病例题关联的病例编号，可跳转病例库查看完整病例 */
  caseId: string | null
  /** 提交后才返回图注（图注常直接写出诊断） */
  images: { url: string; caption: string }[]
}

export type QuestionSet = {
  id: string
  name: string
  shortName: string
  description: string
  kind: 'chapter' | 'case_diagnosis'
  /** 题集现有题目数 */
  total: number
  /** 每次练习随机抽取的题数；为空则练习全部题目 */
  sessionSize: number | null
  /** 全体学生正确率；作答次数太少时为空 */
  avgAccuracy: number | null
  my: { answered: number; accuracy: number | null }
}

export type PracticeSession = {
  id: string
  set: { id: string; name: string }
  startedAt: string
  questions: Question[]
}

export type FinishResult = {
  id: string
  score: number
  correctCount: number
  questionCount: number
  durationSeconds: number | null
  classAvgAccuracy: number | null
  items: {
    questionId: string
    stem: string
    selected: string[]
    answer: string[]
    correct: boolean
  }[]
}

export type PracticeRecord = {
  id: string
  student: { id: string; name: string; studentNo: string | null }
  setName: string
  count: number
  correct: number
  durationSeconds: number | null
  finishedAt: string
}
