/**
 * AI 图像判读类型（与后端 /api/ai/* 一致）
 *
 * 管理员在「设置 → AI 模型」启用模型后，判读结果来自模型（resultSource = 'model:<名称>'）；
 * 未启用时为演示数据（resultSource = 'demo'），页面必须显示演示标识。
 */

export type AiFinding = {
  label: string
  confidence: number
  /** 标注框，单位为图像宽高百分比；模型无法定位时没有 */
  box?: { x: number; y: number; w: number; h: number }
}

/** 当前判读引擎 */
export type AiEngine = { mode: 'model'; model: string } | { mode: 'demo'; model: null }

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
  /** 模型判读时为模型名称，演示结果为 null */
  modelName: string | null
  isDemo: boolean
  disclaimer: string | null
  agreement: Agreement | null
  imageUrl: string | null
  createdAt: string
}
