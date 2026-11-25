/**
 * 病例库模拟数据（演示用，非真实患者信息）
 * 后续接入后端接口后替换
 */

export type CaseSystem =
  | '呼吸系统'
  | '消化系统'
  | '神经系统'
  | '循环系统'
  | '骨骼肌肉'
  | '泌尿生殖'

export type CaseModality = 'X 线' | 'CT' | 'MRI' | '超声' | '病理切片'

export type CaseDifficulty = '基础' | '进阶' | '疑难'

export type MedicalCase = {
  id: string
  title: string
  system: CaseSystem
  modality: CaseModality
  difficulty: CaseDifficulty
  patient: { gender: '男' | '女'; age: number }
  chiefComplaint: string
  history: string
  findings: string
  diagnosis: string
  keyPoints: string[]
  tags: string[]
  imageCount: number
  views: number
  updatedAt: string
}

export const caseSystems: CaseSystem[] = [
  '呼吸系统',
  '消化系统',
  '神经系统',
  '循环系统',
  '骨骼肌肉',
  '泌尿生殖',
]

export const caseModalities: CaseModality[] = [
  'X 线',
  'CT',
  'MRI',
  '超声',
  '病理切片',
]

export const caseDifficulties: CaseDifficulty[] = ['基础', '进阶', '疑难']

export const difficultyClass: Record<CaseDifficulty, string> = {
  基础: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  进阶: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  疑难: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export const cases: MedicalCase[] = [
  {
    id: 'CASE-0001',
    title: '右肺上叶周围型肺癌',
    system: '呼吸系统',
    modality: 'CT',
    difficulty: '进阶',
    patient: { gender: '男', age: 63 },
    chiefComplaint: '刺激性干咳 2 月，痰中带血 1 周',
    history: '吸烟史 40 年，每日约 20 支。无明显发热、盗汗。',
    findings:
      '右肺上叶后段见一不规则软组织密度结节，大小约 2.8cm×2.4cm，边缘可见分叶及短毛刺，邻近胸膜牵拉凹陷；增强扫描呈中度不均匀强化。纵隔 4R 区淋巴结稍大。',
    diagnosis: '右肺上叶周围型肺癌（考虑腺癌可能），伴纵隔淋巴结转移待排',
    keyPoints: [
      '分叶征、毛刺征、胸膜凹陷征是周围型肺癌的典型征象',
      '需与结核球、炎性假瘤鉴别',
      '注意评估纵隔及肺门淋巴结以辅助分期',
    ],
    tags: ['肺结节', '肺癌', '分叶征'],
    imageCount: 24,
    views: 312,
    updatedAt: '2026-11-18',
  },
  {
    id: 'CASE-0002',
    title: '大叶性肺炎（实变期）',
    system: '呼吸系统',
    modality: 'X 线',
    difficulty: '基础',
    patient: { gender: '男', age: 27 },
    chiefComplaint: '高热、寒战 3 天，伴咳铁锈色痰',
    history: '既往体健，发病前有受凉史。',
    findings:
      '右肺中叶见大片状均匀致密影，边界以水平裂为界较清晰，其内可见支气管充气征；右心缘模糊。',
    diagnosis: '右肺中叶大叶性肺炎（实变期）',
    keyPoints: [
      '实变影内的支气管充气征为重要征象',
      '“轮廓征”可帮助定位病变肺叶',
      '治疗后复查以评估吸收情况',
    ],
    tags: ['肺炎', '实变', '支气管充气征'],
    imageCount: 4,
    views: 486,
    updatedAt: '2026-10-29',
  },
  {
    id: 'CASE-0003',
    title: '肝细胞癌',
    system: '消化系统',
    modality: 'CT',
    difficulty: '进阶',
    patient: { gender: '男', age: 55 },
    chiefComplaint: '右上腹隐痛 1 月，体检发现 AFP 升高',
    history: '乙肝病史 20 余年，未规律抗病毒治疗。',
    findings:
      '肝右叶 S8 段见一类圆形肿块，约 4.5cm，动脉期明显不均匀强化，门脉期及延迟期强化减退，呈“快进快出”表现，可见假包膜。肝脏体积缩小，表面呈结节状。',
    diagnosis: '肝右叶肝细胞癌，肝硬化背景',
    keyPoints: [
      '“快进快出”强化方式是 HCC 的典型表现',
      '乙肝/肝硬化背景 + AFP 升高支持诊断',
      '需评估门静脉有无癌栓',
    ],
    tags: ['肝癌', '快进快出', '肝硬化'],
    imageCount: 32,
    views: 298,
    updatedAt: '2026-11-10',
  },
  {
    id: 'CASE-0004',
    title: '急性阑尾炎',
    system: '消化系统',
    modality: '超声',
    difficulty: '基础',
    patient: { gender: '女', age: 22 },
    chiefComplaint: '转移性右下腹痛 12 小时',
    history: '伴恶心，无呕吐，月经规律。',
    findings:
      '右下腹探及一盲端管状结构，外径约 9mm，加压不可压缩，壁增厚，周围脂肪回声增强，腔内可见强回声粪石伴声影。',
    diagnosis: '急性阑尾炎（伴粪石）',
    keyPoints: [
      '阑尾外径 >6mm 且不可压缩提示阑尾炎',
      '育龄女性需排除妇科急腹症',
      '粪石为穿孔高危因素',
    ],
    tags: ['急腹症', '阑尾炎'],
    imageCount: 6,
    views: 402,
    updatedAt: '2026-09-21',
  },
  {
    id: 'CASE-0005',
    title: '急性脑梗死',
    system: '神经系统',
    modality: 'MRI',
    difficulty: '基础',
    patient: { gender: '男', age: 71 },
    chiefComplaint: '突发左侧肢体无力 5 小时',
    history: '高血压病史 15 年，房颤病史 3 年。',
    findings:
      '右侧基底节区及放射冠见斑片状 DWI 高信号，ADC 图呈低信号，T2 FLAIR 呈稍高信号；MRA 示右侧大脑中动脉 M1 段远端显影中断。',
    diagnosis: '右侧大脑中动脉供血区急性脑梗死',
    keyPoints: [
      'DWI 高信号 + ADC 低信号提示细胞毒性水肿',
      'DWI-FLAIR 不匹配有助于判断发病时间窗',
      '房颤患者需考虑心源性栓塞',
    ],
    tags: ['脑梗死', 'DWI', '卒中'],
    imageCount: 48,
    views: 521,
    updatedAt: '2026-11-02',
  },
  {
    id: 'CASE-0006',
    title: '脑膜瘤',
    system: '神经系统',
    modality: 'MRI',
    difficulty: '进阶',
    patient: { gender: '女', age: 52 },
    chiefComplaint: '反复头痛半年',
    history: '无外伤史，近期偶有视物模糊。',
    findings:
      '左侧额部大脑凸面见一宽基底附着于硬脑膜的类圆形肿块，T1WI 等信号、T2WI 稍高信号，增强后明显均匀强化，可见“脑膜尾征”，邻近脑组织受压，可见白质塌陷征。',
    diagnosis: '左额部凸面脑膜瘤',
    keyPoints: [
      '脑外肿瘤征象：宽基底、白质塌陷、脑脊液间隙',
      '“脑膜尾征”常见但非特异',
      '注意与孤立性纤维性肿瘤鉴别',
    ],
    tags: ['脑膜瘤', '脑外肿瘤', '脑膜尾征'],
    imageCount: 36,
    views: 267,
    updatedAt: '2026-10-15',
  },
  {
    id: 'CASE-0007',
    title: '主动脉夹层（Stanford A 型）',
    system: '循环系统',
    modality: 'CT',
    difficulty: '疑难',
    patient: { gender: '男', age: 48 },
    chiefComplaint: '突发胸背部撕裂样疼痛 3 小时',
    history: '高血压病史，血压控制差。',
    findings:
      'CTA 示升主动脉至腹主动脉见内膜片影，将主动脉分为真假两腔，假腔较大，破口位于升主动脉近端；头臂干受累。',
    diagnosis: '主动脉夹层（Stanford A 型 / DeBakey I 型）',
    keyPoints: [
      '内膜片与双腔结构是诊断关键',
      '累及升主动脉即为 Stanford A 型，需急诊手术',
      '注意评估分支血管受累及灌注情况',
    ],
    tags: ['急诊', '主动脉夹层', 'CTA'],
    imageCount: 64,
    views: 389,
    updatedAt: '2026-11-20',
  },
  {
    id: 'CASE-0008',
    title: '桡骨远端骨折（Colles 骨折）',
    system: '骨骼肌肉',
    modality: 'X 线',
    difficulty: '基础',
    patient: { gender: '女', age: 66 },
    chiefComplaint: '跌倒时手掌撑地后腕部疼痛、畸形 2 小时',
    history: '绝经 15 年，未规律补钙。',
    findings:
      '右侧桡骨远端距关节面约 2.5cm 处见横行骨折线，远折端向背侧及桡侧移位，侧位呈“餐叉样”畸形，合并尺骨茎突骨折。',
    diagnosis: '右桡骨远端伸直型骨折（Colles 骨折）合并尺骨茎突骨折',
    keyPoints: [
      '远折端向背侧移位 → 餐叉样畸形',
      '老年女性需关注骨质疏松',
      '注意与 Smith 骨折（屈曲型）区分',
    ],
    tags: ['骨折', '腕部', '骨质疏松'],
    imageCount: 3,
    views: 356,
    updatedAt: '2026-09-30',
  },
  {
    id: 'CASE-0009',
    title: '膝关节前交叉韧带断裂',
    system: '骨骼肌肉',
    modality: 'MRI',
    difficulty: '进阶',
    patient: { gender: '男', age: 24 },
    chiefComplaint: '打篮球扭伤右膝后肿痛、不稳 1 周',
    history: '受伤时自觉膝关节内“砰”的响声。',
    findings:
      '右膝前交叉韧带连续性中断，信号弥漫性增高，形态模糊；股骨外侧髁及胫骨平台后外侧可见骨挫伤水肿信号；关节腔积液。',
    diagnosis: '右膝前交叉韧带完全断裂，伴对吻性骨挫伤',
    keyPoints: [
      '对吻性骨挫伤是 ACL 断裂的间接征象',
      '矢状位观察韧带走行与连续性',
      '注意合并半月板损伤',
    ],
    tags: ['运动损伤', '韧带', '膝关节'],
    imageCount: 40,
    views: 214,
    updatedAt: '2026-10-08',
  },
  {
    id: 'CASE-0010',
    title: '肾透明细胞癌',
    system: '泌尿生殖',
    modality: 'CT',
    difficulty: '进阶',
    patient: { gender: '男', age: 58 },
    chiefComplaint: '体检发现左肾占位',
    history: '无肉眼血尿，无腰痛。',
    findings:
      '左肾中下极见一外生性肿块，约 5.2cm，皮质期明显不均匀强化，强化程度接近肾皮质，实质期廓清，内见坏死低密度区；左肾静脉未见癌栓。',
    diagnosis: '左肾透明细胞癌（cT1b）',
    keyPoints: [
      '富血供、快速廓清是透明细胞癌的特点',
      '需与乏脂型血管平滑肌脂肪瘤鉴别',
      '评估肾静脉及下腔静脉癌栓',
    ],
    tags: ['肾癌', '富血供'],
    imageCount: 28,
    views: 176,
    updatedAt: '2026-11-12',
  },
  {
    id: 'CASE-0011',
    title: '乳腺浸润性导管癌',
    system: '泌尿生殖',
    modality: '病理切片',
    difficulty: '疑难',
    patient: { gender: '女', age: 46 },
    chiefComplaint: '发现左乳肿物 2 月',
    history: '肿物无痛，渐增大，无乳头溢液。',
    findings:
      '镜下见肿瘤细胞呈巢状、条索状浸润性生长，细胞异型明显，核分裂象易见，间质纤维组织增生，未见明确导管原位癌成分残留。',
    diagnosis: '左乳浸润性导管癌（非特殊类型），组织学分级 II 级',
    keyPoints: [
      'Nottingham 分级：腺管形成、核多形性、核分裂计数',
      '需补充 ER/PR/HER2/Ki-67 免疫组化',
      '关注脉管侵犯与切缘情况',
    ],
    tags: ['病理', '乳腺癌', '免疫组化'],
    imageCount: 12,
    views: 158,
    updatedAt: '2026-11-05',
  },
  {
    id: 'CASE-0012',
    title: '肺结核（继发性）',
    system: '呼吸系统',
    modality: 'CT',
    difficulty: '进阶',
    patient: { gender: '女', age: 34 },
    chiefComplaint: '低热、盗汗、乏力 1 月余',
    history: '体重下降约 4kg，有结核患者接触史。',
    findings:
      '双肺上叶尖后段见多发斑片、结节及“树芽征”，右上叶见厚壁空洞，内壁光整，周围卫星灶；部分病灶内见钙化。',
    diagnosis: '继发性肺结核（浸润型，伴空洞形成）',
    keyPoints: [
      '好发于上叶尖后段及下叶背段',
      '“树芽征”提示支气管播散',
      '多形性病灶（渗出、增殖、钙化共存）具有提示意义',
    ],
    tags: ['结核', '空洞', '树芽征'],
    imageCount: 20,
    views: 243,
    updatedAt: '2026-10-22',
  },
]
