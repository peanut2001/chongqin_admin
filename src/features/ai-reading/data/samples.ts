/**
 * AI 图像判读模拟数据（演示用，非真实模型输出）
 * 后续对接真实 AI 判读接口后替换
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
  caseId: string
  result: AiResult
}

export const aiModalities = [
  '胸部 CT',
  '胸部 X 线',
  '头颅 MRI',
  '腹部 CT',
  '病理切片',
]

export const aiSamples: AiSample[] = [
  {
    id: 'S-01',
    name: '胸部 CT · 肺结节',
    modality: '胸部 CT',
    caseId: 'CASE-0001',
    result: {
      findings: [
        {
          label: '右肺上叶结节（分叶、毛刺）',
          confidence: 0.94,
          box: { x: 22, y: 28, w: 18, h: 16 },
        },
        {
          label: '胸膜凹陷',
          confidence: 0.81,
          box: { x: 14, y: 24, w: 10, h: 12 },
        },
        {
          label: '纵隔淋巴结稍大',
          confidence: 0.63,
          box: { x: 46, y: 40, w: 9, h: 9 },
        },
      ],
      impression:
        '右肺上叶实性结节，恶性风险较高（Lung-RADS 4B），建议结合增强 CT 与病理检查。',
      suggestions: [
        '增强 CT 评估强化特点',
        'CT 引导下穿刺活检',
        '必要时行 PET-CT 分期',
      ],
      elapsedMs: 1820,
    },
  },
  {
    id: 'S-02',
    name: '胸部 X 线 · 实变影',
    modality: '胸部 X 线',
    caseId: 'CASE-0002',
    result: {
      findings: [
        {
          label: '右肺中叶实变影',
          confidence: 0.91,
          box: { x: 18, y: 45, w: 26, h: 20 },
        },
        {
          label: '支气管充气征',
          confidence: 0.77,
          box: { x: 26, y: 50, w: 10, h: 10 },
        },
      ],
      impression: '右肺中叶大片实变，考虑大叶性肺炎可能。',
      suggestions: ['结合血常规及 CRP', '抗感染治疗后 2-4 周复查'],
      elapsedMs: 960,
    },
  },
  {
    id: 'S-03',
    name: '头颅 MRI · DWI 高信号',
    modality: '头颅 MRI',
    caseId: 'CASE-0005',
    result: {
      findings: [
        {
          label: '右侧基底节区 DWI 高信号',
          confidence: 0.96,
          box: { x: 54, y: 38, w: 16, h: 18 },
        },
        {
          label: '右侧放射冠受累',
          confidence: 0.84,
          box: { x: 56, y: 24, w: 12, h: 12 },
        },
      ],
      impression: '右侧大脑中动脉供血区急性脑梗死可能性大。',
      suggestions: [
        '结合 ADC 图确认扩散受限',
        '评估 DWI-FLAIR 不匹配',
        '完善 MRA / CTA 评估责任血管',
      ],
      elapsedMs: 2140,
    },
  },
  {
    id: 'S-04',
    name: '腹部 CT · 肝占位',
    modality: '腹部 CT',
    caseId: 'CASE-0003',
    result: {
      findings: [
        {
          label: '肝 S8 段富血供占位',
          confidence: 0.92,
          box: { x: 20, y: 22, w: 22, h: 20 },
        },
        {
          label: '肝脏表面结节状（肝硬化）',
          confidence: 0.79,
          box: { x: 10, y: 18, w: 40, h: 40 },
        },
      ],
      impression: '肝硬化背景下富血供占位，符合 LI-RADS 5，考虑肝细胞癌。',
      suggestions: [
        '结合 AFP 等肿瘤标志物',
        '评估门静脉癌栓',
        'MDT 讨论治疗方案',
      ],
      elapsedMs: 2460,
    },
  },
]

/** 上传图片时使用的通用模拟结果 */
export function mockResultFor(modality: string): AiResult {
  return {
    findings: [
      {
        label: `${modality}：可疑异常区域 1`,
        confidence: 0.82,
        box: { x: 30, y: 30, w: 20, h: 18 },
      },
      {
        label: `${modality}：可疑异常区域 2`,
        confidence: 0.58,
        box: { x: 58, y: 52, w: 14, h: 12 },
      },
    ],
    impression:
      '检测到可疑异常区域（演示结果），请结合临床资料及上级医师意见综合判断。',
    suggestions: ['对照病例库中相似病例', '与带教老师讨论判读结果'],
    elapsedMs: 1500,
  }
}

export type AiRecord = {
  id: string
  student: string
  sample: string
  aiImpression: string
  agreement: '一致' | '部分一致' | '不一致'
  createdAt: string
}

export const aiRecords: AiRecord[] = [
  {
    id: 'AI-3381',
    student: '李明',
    sample: '胸部 CT · 肺结节',
    aiImpression: '周围型肺癌可能',
    agreement: '一致',
    createdAt: '2026-11-24 10:05',
  },
  {
    id: 'AI-3380',
    student: '王雪',
    sample: '头颅 MRI · DWI 高信号',
    aiImpression: '急性脑梗死',
    agreement: '一致',
    createdAt: '2026-11-24 09:12',
  },
  {
    id: 'AI-3379',
    student: '刘洋',
    sample: '腹部 CT · 肝占位',
    aiImpression: '肝细胞癌',
    agreement: '部分一致',
    createdAt: '2026-11-23 21:48',
  },
  {
    id: 'AI-3378',
    student: '孙磊',
    sample: '胸部 X 线 · 实变影',
    aiImpression: '大叶性肺炎',
    agreement: '不一致',
    createdAt: '2026-11-23 15:30',
  },
  {
    id: 'AI-3377',
    student: '周敏',
    sample: '胸部 CT · 肺结节',
    aiImpression: '周围型肺癌可能',
    agreement: '一致',
    createdAt: '2026-11-23 10:21',
  },
]
