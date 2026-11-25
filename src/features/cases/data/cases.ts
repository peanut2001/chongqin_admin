/**
 * 病例库类型与展示辅助
 *
 * 一个病例 = 一位真实患者：影像、病例原文均来自 MultiCaRe 数据集 v3.0.1
 * （PubMed Central 开放获取病例报告），出处与许可随病例展示。
 * 数据由后端 /api/topics、/api/cases 提供（教学内容由 flask content import 导入）。
 */

export type CaseSystem =
  | '呼吸系统'
  | '消化系统'
  | '神经系统'
  | '循环系统'
  | '骨骼肌肉'
  | '泌尿生殖'
  | '妇产科'
  | '内分泌系统'
  | '浅表器官'

export type CaseModality = 'X 线' | 'CT' | 'MRI' | '超声' | '病理切片'

export type CaseDifficulty = '基础' | '进阶' | '疑难'

/** 病种：中文教学内容，病例按病种归类 */
export type DiseaseTopic = {
  id: string
  title: string
  system: CaseSystem
  modality: CaseModality
  difficulty: CaseDifficulty
  /** 典型影像 / 镜下表现（通用教学描述） */
  summary: string
  keyPoints: string[]
  tags: string[]
}

export type Gender = 'Male' | 'Female' | 'Transgender' | 'Unknown'

/** 病例中的单幅影像 */
export type CaseImage = {
  id: string
  /** 后端图片地址（不含病例编号） */
  url: string
  /** 原始图注（英文，来自论文） */
  caption: string
  /** radiology / pathology / endoscopy / medical_photograph */
  type: string
  width: number
  height: number
}

/** 病例出处（原始病例报告论文） */
export type CaseSource = {
  pmcid: string
  title: string
  authors: string[]
  journal: string
  year: string
  doi: string
  /** 论文许可，如 CC BY、CC BY-NC */
  license: string
}

export type CaseRecord = {
  id: string
  topicId: string
  patientId: string
  age: number | null
  gender: Gender
  /** 病例原文开头一段（英文），用于列表展示与搜索 */
  excerpt: string
  coverIndex: number
  source: CaseSource
  images: CaseImage[]
}

export type MedicalCase = CaseRecord & { topic: DiseaseTopic }

export const caseSystems: CaseSystem[] = [
  '消化系统',
  '泌尿生殖',
  '妇产科',
  '内分泌系统',
  '浅表器官',
  '循环系统',
  '骨骼肌肉',
  '呼吸系统',
  '神经系统',
]

export const caseModalities: CaseModality[] = [
  '超声',
  'X 线',
  'CT',
  'MRI',
  '病理切片',
]

export const caseDifficulties: CaseDifficulty[] = ['基础', '进阶', '疑难']

export const difficultyClass: Record<CaseDifficulty, string> = {
  基础: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  进阶: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  疑难: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export const genderLabels: Record<Gender, string> = {
  Male: '男',
  Female: '女',
  Transgender: '跨性别',
  Unknown: '性别未知',
}

export const imageTypeLabels: Record<string, string> = {
  radiology: '影像',
  pathology: '病理',
  endoscopy: '内镜',
  medical_photograph: '临床照片',
  ophthalmic_imaging: '眼科影像',
}

/** 「男，55 岁」 */
export function patientLabel(c: Pick<MedicalCase, 'age' | 'gender'>) {
  const age =
    c.age === null ? '年龄未知' : c.age === 0 ? '<1 岁' : `${c.age} 岁`
  return `${genderLabels[c.gender]}，${age}`
}

/** 数据集出处（页面统一标注） */
export const datasetSource = {
  name: 'MultiCaRe 数据集 v3.0.1',
  recordUrl: 'https://zenodo.org/records/20416562',
  paperDoi: '10.3390/data10080123',
}

/** 病例 + 所属病种（病种由 /api/topics 提供，按 topicId 关联） */
export function attachTopics(
  records: CaseRecord[],
  topics: DiseaseTopic[]
): MedicalCase[] {
  const byId = new Map(topics.map((t) => [t.id, t]))
  return records.flatMap((r) => {
    const topic = byId.get(r.topicId)
    return topic ? [{ ...r, topic }] : []
  })
}
