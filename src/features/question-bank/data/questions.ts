/**
 * 题库模拟数据（演示用）
 * total 为章节题库规模的模拟统计；questions 为可直接练习的示例题目
 */

export type QuestionType = '单选题' | '多选题' | '判断题'

export type Question = {
  id: string
  type: QuestionType
  stem: string
  options: { key: string; text: string }[]
  answer: string[]
  explanation: string
  /** 关联病例编号（可选） */
  caseId?: string
}

export type QuestionSet = {
  id: string
  name: string
  description: string
  total: number
  /** 班级平均正确率（模拟） */
  avgAccuracy: number
  questions: Question[]
}

const judgeOptions = [
  { key: 'T', text: '正确' },
  { key: 'F', text: '错误' },
]

export const questionSets: QuestionSet[] = [
  {
    id: 'chest',
    name: '胸部影像诊断',
    description: '肺结节、肺炎、肺结核、纵隔病变等',
    total: 286,
    avgAccuracy: 78,
    questions: [
      {
        id: 'Q-C-001',
        type: '单选题',
        stem: '男，63 岁，长期吸烟。CT 示右肺上叶 2.8cm 结节，边缘分叶、短毛刺，伴胸膜凹陷。最可能的诊断是：',
        options: [
          { key: 'A', text: '结核球' },
          { key: 'B', text: '错构瘤' },
          { key: 'C', text: '周围型肺癌' },
          { key: 'D', text: '炎性假瘤' },
          { key: 'E', text: '肺隔离症' },
        ],
        answer: ['C'],
        explanation:
          '分叶征、毛刺征、胸膜凹陷征是周围型肺癌的典型征象，结合高龄与长期吸烟史，首先考虑周围型肺癌。',
        caseId: 'CASE-0001',
      },
      {
        id: 'Q-C-002',
        type: '多选题',
        stem: '以下哪些征象支持继发性肺结核的诊断？',
        options: [
          { key: 'A', text: '病灶好发于上叶尖后段' },
          { key: 'B', text: '树芽征' },
          { key: 'C', text: '渗出、增殖、钙化病灶共存' },
          { key: 'D', text: '病灶仅位于下叶基底段' },
        ],
        answer: ['A', 'B', 'C'],
        explanation:
          '继发性肺结核好发于上叶尖后段及下叶背段，常见多形性病灶共存，树芽征提示支气管播散。',
        caseId: 'CASE-0012',
      },
      {
        id: 'Q-C-003',
        type: '判断题',
        stem: '支气管充气征只见于大叶性肺炎，可作为其特异性诊断依据。',
        options: judgeOptions,
        answer: ['F'],
        explanation:
          '支气管充气征见于多种肺实变性病变（如肺炎、浸润性黏液腺癌、淋巴瘤等），并不特异。',
        caseId: 'CASE-0002',
      },
    ],
  },
  {
    id: 'abdomen',
    name: '腹部影像诊断',
    description: '肝胆胰脾、胃肠道、急腹症等',
    total: 312,
    avgAccuracy: 72,
    questions: [
      {
        id: 'Q-A-001',
        type: '单选题',
        stem: '乙肝肝硬化患者，增强 CT 示肝内肿块动脉期明显强化、门脉期廓清。该强化方式通常描述为：',
        options: [
          { key: 'A', text: '慢进慢出' },
          { key: 'B', text: '快进快出' },
          { key: 'C', text: '早出晚归' },
          { key: 'D', text: '环形强化' },
        ],
        answer: ['B'],
        explanation:
          '肝细胞癌主要由肝动脉供血，典型表现为动脉期明显强化、门脉期/延迟期廓清，即“快进快出”。',
        caseId: 'CASE-0003',
      },
      {
        id: 'Q-A-002',
        type: '单选题',
        stem: '超声诊断急性阑尾炎时，提示阳性的阑尾外径一般大于：',
        options: [
          { key: 'A', text: '3mm' },
          { key: 'B', text: '4mm' },
          { key: 'C', text: '6mm' },
          { key: 'D', text: '12mm' },
        ],
        answer: ['C'],
        explanation:
          '阑尾外径 >6mm 且加压不可压缩，是急性阑尾炎常用的超声诊断标准。',
        caseId: 'CASE-0004',
      },
      {
        id: 'Q-A-003',
        type: '判断题',
        stem: '阑尾腔内粪石是阑尾穿孔的高危因素之一。',
        options: judgeOptions,
        answer: ['T'],
        explanation: '粪石可导致阑尾腔梗阻、压力升高，增加坏疽和穿孔风险。',
      },
    ],
  },
  {
    id: 'neuro',
    name: '神经影像诊断',
    description: '脑血管病、颅内肿瘤、脱髓鞘病变等',
    total: 248,
    avgAccuracy: 69,
    questions: [
      {
        id: 'Q-N-001',
        type: '单选题',
        stem: '急性脑梗死在 MRI 上最早出现异常的序列通常是：',
        options: [
          { key: 'A', text: 'T1WI' },
          { key: 'B', text: 'T2WI' },
          { key: 'C', text: 'DWI' },
          { key: 'D', text: 'SWI' },
        ],
        answer: ['C'],
        explanation:
          '细胞毒性水肿导致水分子扩散受限，DWI 在发病数分钟至数小时内即可呈高信号，ADC 值降低。',
        caseId: 'CASE-0005',
      },
      {
        id: 'Q-N-002',
        type: '多选题',
        stem: '提示颅内病变位于脑外的征象包括：',
        options: [
          { key: 'A', text: '宽基底附着于硬脑膜' },
          { key: 'B', text: '白质塌陷征' },
          { key: 'C', text: '病灶与脑组织间存在脑脊液间隙' },
          { key: 'D', text: '病灶周围白质指状水肿且位于脑实质内' },
        ],
        answer: ['A', 'B', 'C'],
        explanation:
          '宽基底、白质塌陷征、脑脊液裂隙征均为脑外肿瘤的定位征象；D 项提示脑内病变。',
        caseId: 'CASE-0006',
      },
      {
        id: 'Q-N-003',
        type: '判断题',
        stem: '“脑膜尾征”是脑膜瘤的特异性征象，出现即可确诊。',
        options: judgeOptions,
        answer: ['F'],
        explanation:
          '脑膜尾征常见于脑膜瘤，但也可见于转移瘤、淋巴瘤等，不具特异性。',
      },
    ],
  },
  {
    id: 'msk',
    name: '骨骼肌肉影像',
    description: '骨折、关节损伤、骨肿瘤等',
    total: 196,
    avgAccuracy: 81,
    questions: [
      {
        id: 'Q-M-001',
        type: '单选题',
        stem: '老年女性跌倒手掌撑地，X 线示桡骨远端骨折，远折端向背侧移位，呈“餐叉样”畸形。诊断为：',
        options: [
          { key: 'A', text: 'Smith 骨折' },
          { key: 'B', text: 'Colles 骨折' },
          { key: 'C', text: 'Barton 骨折' },
          { key: 'D', text: 'Monteggia 骨折' },
        ],
        answer: ['B'],
        explanation:
          'Colles 骨折为桡骨远端伸直型骨折，远折端向背侧、桡侧移位，侧位呈餐叉样畸形。',
        caseId: 'CASE-0008',
      },
      {
        id: 'Q-M-002',
        type: '单选题',
        stem: '膝关节 MRI 中，股骨外侧髁与胫骨平台后外侧的“对吻性骨挫伤”最常提示：',
        options: [
          { key: 'A', text: '后交叉韧带断裂' },
          { key: 'B', text: '内侧副韧带损伤' },
          { key: 'C', text: '前交叉韧带断裂' },
          { key: 'D', text: '髌骨脱位' },
        ],
        answer: ['C'],
        explanation:
          '对吻性骨挫伤是前交叉韧带断裂的重要间接征象，由轴移损伤机制所致。',
        caseId: 'CASE-0009',
      },
    ],
  },
  {
    id: 'pathology',
    name: '病理诊断基础',
    description: '肿瘤病理、组织学分级、免疫组化',
    total: 244,
    avgAccuracy: 66,
    questions: [
      {
        id: 'Q-P-001',
        type: '多选题',
        stem: '乳腺浸润性癌 Nottingham 组织学分级的评估指标包括：',
        options: [
          { key: 'A', text: '腺管形成比例' },
          { key: 'B', text: '核多形性' },
          { key: 'C', text: '核分裂象计数' },
          { key: 'D', text: 'HER2 表达状态' },
        ],
        answer: ['A', 'B', 'C'],
        explanation:
          'Nottingham 分级由腺管形成、核多形性与核分裂计数三项评分相加；HER2 为分子分型指标。',
        caseId: 'CASE-0011',
      },
      {
        id: 'Q-P-002',
        type: '判断题',
        stem: '乳腺癌术后标本常规需补充 ER、PR、HER2 及 Ki-67 免疫组化检测。',
        options: judgeOptions,
        answer: ['T'],
        explanation:
          '上述指标用于分子分型并指导内分泌及靶向治疗，是常规检测项目。',
      },
    ],
  },
]

/** 练习记录（模拟） */
export type PracticeRecord = {
  id: string
  student: string
  setName: string
  count: number
  correct: number
  duration: string
  finishedAt: string
}

export const practiceRecords: PracticeRecord[] = [
  {
    id: 'R-1024',
    student: '李明',
    setName: '胸部影像诊断',
    count: 30,
    correct: 26,
    duration: '18 分钟',
    finishedAt: '2026-11-24 10:32',
  },
  {
    id: 'R-1023',
    student: '王雪',
    setName: '神经影像诊断',
    count: 20,
    correct: 13,
    duration: '15 分钟',
    finishedAt: '2026-11-24 09:47',
  },
  {
    id: 'R-1022',
    student: '陈浩',
    setName: '腹部影像诊断',
    count: 25,
    correct: 19,
    duration: '21 分钟',
    finishedAt: '2026-11-23 22:15',
  },
  {
    id: 'R-1021',
    student: '刘洋',
    setName: '病理诊断基础',
    count: 15,
    correct: 9,
    duration: '12 分钟',
    finishedAt: '2026-11-23 20:03',
  },
  {
    id: 'R-1020',
    student: '赵婷',
    setName: '骨骼肌肉影像',
    count: 20,
    correct: 18,
    duration: '14 分钟',
    finishedAt: '2026-11-23 16:40',
  },
  {
    id: 'R-1019',
    student: '孙磊',
    setName: '胸部影像诊断',
    count: 30,
    correct: 22,
    duration: '25 分钟',
    finishedAt: '2026-11-23 11:28',
  },
  {
    id: 'R-1018',
    student: '周敏',
    setName: '腹部影像诊断',
    count: 20,
    correct: 17,
    duration: '16 分钟',
    finishedAt: '2026-11-22 21:56',
  },
]
