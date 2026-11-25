/**
 * 学情统计模拟数据（演示用）
 * 仪表盘也复用此处数据，后续接入后端统计接口后统一替换
 */

export const semester = {
  name: '2026-2027 学年第一学期',
  course: '医学影像诊断学（研究生）',
  startDate: '2026-09-07',
  endDate: '2027-01-10',
  totalWeeks: 18,
  currentWeek: 12,
}

export const classes = [
  '全部班级',
  '2025 级影像硕士 1 班',
  '2025 级影像硕士 2 班',
]

/** 每个教学周的学习活跃度（截至当前周） */
export const weeklyActivity = [
  { week: '第1周', practice: 186, caseViews: 320, aiReads: 42, accuracy: 61 },
  { week: '第2周', practice: 254, caseViews: 402, aiReads: 68, accuracy: 63 },
  { week: '第3周', practice: 298, caseViews: 455, aiReads: 91, accuracy: 66 },
  { week: '第4周', practice: 342, caseViews: 498, aiReads: 103, accuracy: 65 },
  { week: '第5周', practice: 315, caseViews: 476, aiReads: 117, accuracy: 68 },
  { week: '第6周', practice: 388, caseViews: 530, aiReads: 132, accuracy: 70 },
  { week: '第7周', practice: 276, caseViews: 389, aiReads: 98, accuracy: 69 },
  { week: '第8周', practice: 421, caseViews: 566, aiReads: 158, accuracy: 72 },
  { week: '第9周', practice: 456, caseViews: 602, aiReads: 171, accuracy: 73 },
  { week: '第10周', practice: 437, caseViews: 588, aiReads: 165, accuracy: 75 },
  { week: '第11周', practice: 489, caseViews: 641, aiReads: 189, accuracy: 76 },
  { week: '第12周', practice: 512, caseViews: 675, aiReads: 203, accuracy: 77 },
]

/** 各章节掌握度（班级平均正确率） */
export const chapterMastery = [
  { chapter: '胸部影像', mastery: 78 },
  { chapter: '腹部影像', mastery: 72 },
  { chapter: '神经影像', mastery: 69 },
  { chapter: '骨骼肌肉', mastery: 81 },
  { chapter: '病理基础', mastery: 66 },
]

/** 各功能模块使用占比（学习时长，小时） */
export const moduleUsage = [
  { name: '病例库浏览', value: 412, fill: 'var(--chart-1)' },
  { name: '题库练习', value: 538, fill: 'var(--chart-2)' },
  { name: 'AI 图像判读', value: 226, fill: 'var(--chart-3)' },
  { name: '课程资料', value: 145, fill: 'var(--chart-4)' },
]

export type StudentStat = {
  id: string
  name: string
  className: string
  studyHours: number
  practiceCount: number
  accuracy: number
  caseViews: number
  aiReads: number
  lastActive: string
}

export const studentStats: StudentStat[] = [
  {
    id: 'S2025001',
    name: '李明',
    className: '2025 级影像硕士 1 班',
    studyHours: 62.5,
    practiceCount: 486,
    accuracy: 86,
    caseViews: 132,
    aiReads: 48,
    lastActive: '2026-11-24 10:32',
  },
  {
    id: 'S2025002',
    name: '王雪',
    className: '2025 级影像硕士 1 班',
    studyHours: 55.0,
    practiceCount: 402,
    accuracy: 74,
    caseViews: 118,
    aiReads: 41,
    lastActive: '2026-11-24 09:47',
  },
  {
    id: 'S2025003',
    name: '陈浩',
    className: '2025 级影像硕士 1 班',
    studyHours: 48.2,
    practiceCount: 376,
    accuracy: 79,
    caseViews: 97,
    aiReads: 35,
    lastActive: '2026-11-23 22:15',
  },
  {
    id: 'S2025004',
    name: '刘洋',
    className: '2025 级影像硕士 1 班',
    studyHours: 31.6,
    practiceCount: 214,
    accuracy: 62,
    caseViews: 64,
    aiReads: 19,
    lastActive: '2026-11-23 20:03',
  },
  {
    id: 'S2025005',
    name: '赵婷',
    className: '2025 级影像硕士 1 班',
    studyHours: 58.9,
    practiceCount: 455,
    accuracy: 88,
    caseViews: 126,
    aiReads: 52,
    lastActive: '2026-11-23 16:40',
  },
  {
    id: 'S2025006',
    name: '孙磊',
    className: '2025 级影像硕士 2 班',
    studyHours: 44.3,
    practiceCount: 338,
    accuracy: 71,
    caseViews: 89,
    aiReads: 30,
    lastActive: '2026-11-23 11:28',
  },
  {
    id: 'S2025007',
    name: '周敏',
    className: '2025 级影像硕士 2 班',
    studyHours: 51.7,
    practiceCount: 390,
    accuracy: 83,
    caseViews: 110,
    aiReads: 44,
    lastActive: '2026-11-22 21:56',
  },
  {
    id: 'S2025008',
    name: '吴迪',
    className: '2025 级影像硕士 2 班',
    studyHours: 22.4,
    practiceCount: 158,
    accuracy: 58,
    caseViews: 41,
    aiReads: 12,
    lastActive: '2026-11-19 14:22',
  },
  {
    id: 'S2025009',
    name: '郑悦',
    className: '2025 级影像硕士 2 班',
    studyHours: 47.8,
    practiceCount: 362,
    accuracy: 77,
    caseViews: 102,
    aiReads: 37,
    lastActive: '2026-11-22 19:08',
  },
  {
    id: 'S2025010',
    name: '黄凯',
    className: '2025 级影像硕士 2 班',
    studyHours: 39.1,
    practiceCount: 287,
    accuracy: 69,
    caseViews: 76,
    aiReads: 26,
    lastActive: '2026-11-21 17:45',
  },
]

/** 最近学习动态（仪表盘用） */
export const recentActivities = [
  {
    name: '李明',
    action: '完成「胸部影像诊断」练习',
    detail: '正确率 87%',
    time: '10 分钟前',
  },
  {
    name: '王雪',
    action: '浏览病例「急性脑梗死」',
    detail: 'MRI · 神经系统',
    time: '35 分钟前',
  },
  {
    name: '赵婷',
    action: '提交 AI 判读对照',
    detail: '与 AI 结果一致',
    time: '1 小时前',
  },
  {
    name: '陈浩',
    action: '完成「腹部影像诊断」练习',
    detail: '正确率 76%',
    time: '昨天 22:15',
  },
  {
    name: '刘洋',
    action: '浏览病例「肝细胞癌」',
    detail: 'CT · 消化系统',
    time: '昨天 20:31',
  },
]
