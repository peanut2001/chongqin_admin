/**
 * AI 图像判读类型（与后端 /api/ai/* 一致）
 *
 * 目前后端未接入真实模型，判读结果为演示数据（resultSource = 'demo'），
 * 页面必须显示演示标识。
 */

export type AiFinding = {
  label: string
  confidence: number
  /** 标注框，单位为图像宽高百分比 */
  box: { x: number; y: number; w: number; h: number }
}

export type AiResult = {
  findings: AiFinding[]
  impression: string
  suggestions: string[]
  elapsedMs: number
}

export type AiSample = {
  id: string
  name: string
  modality: string
  imageUrl: string | null
}

export type Agreement = '一致' | '部分一致' | '不一致'

export const agreements: Agreement[] = ['一致', '部分一致', '不一致']

export type AiReading = {
  id: string
  student: string | null
  sample: string
  sampleId: string | null
  modality: string
  opinion: string
  result: AiResult
  resultSource: string
  isDemo: boolean
  disclaimer: string | null
  agreement: Agreement | null
  imageUrl: string | null
  createdAt: string
}
