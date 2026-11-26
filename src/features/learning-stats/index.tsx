import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  Award,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { apiErrorTitle } from '@/lib/api/client'
import { useMeta } from '@/lib/api/meta'
import { type echarts } from '@/lib/echarts'
import { cn, getPageNumbers } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { NumberTicker } from '@/components/number-ticker'
import { SimpleProgress } from '@/components/simple-progress'
import { ACCURACY_BANDS, inBand, summarizeClasses } from './analysis'
import {
  formatRelativeTime,
  type StudentStat,
  useStatsOverview,
  useStudentStats,
} from './api'
import { GroupAdviceDialog } from './components/group-advice-dialog'
import { AccuracyHistogram, ClassCompare } from './components/linked-charts'
import {
  type PlottedStudent,
  StudentScatter,
} from './components/student-scatter'
import { StudentSheet } from './components/student-sheet'

type SortKey = 'accuracy' | 'studyHours' | 'practiceCount'

const sortText: Record<SortKey, string> = {
  accuracy: '按正确率',
  studyHours: '按学习时长',
  practiceCount: '按练习题数',
}

const ALL = 'all'
const route = getRouteApi('/_authenticated/learning-stats/')

/** 联动筛选：学生分组卡片、散点图框选、正确率区间（同一时间只生效一种） */
type Selection =
  | { source: 'preset'; preset: PresetKey; ids: Set<string> }
  | { source: 'brush'; ids: Set<string> }
  | { source: 'band'; band: number; ids: Set<string> }

/* ===================== 学生分组（快捷筛选） ===================== */

type PresetKey = 'attention' | 'inactive' | 'unanswered' | 'top'

type Preset = {
  key: PresetKey | 'all'
  label: string
  desc: string
  icon: LucideIcon
  tone: 'default' | 'danger' | 'warning' | 'success'
}

const PRESETS: Preset[] = [
  {
    key: 'all',
    label: '全部学生',
    desc: '当前班级范围',
    icon: Users,
    tone: 'default',
  },
  {
    key: 'attention',
    label: '需关注',
    desc: '正确率偏低或学时不足',
    icon: TriangleAlert,
    tone: 'danger',
  },
  {
    key: 'inactive',
    label: '近 7 天未学习',
    desc: '一周内没有学习记录',
    icon: CalendarX,
    tone: 'warning',
  },
  {
    key: 'unanswered',
    label: '还未作答',
    desc: '本学期没有练习记录',
    icon: CircleDashed,
    tone: 'default',
  },
  {
    key: 'top',
    label: '学优生',
    desc: '正确率 ≥90% 且学时不低于人均',
    icon: Award,
    tone: 'success',
  },
]

const toneClass: Record<Preset['tone'], string> = {
  default: 'bg-primary/10 text-primary',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

function matchPreset(
  key: PresetKey,
  s: StudentStat,
  ctx: { avgHours: number; weekAgo: number }
) {
  switch (key) {
    case 'attention':
      return s.needsAttention
    case 'inactive':
      return !s.lastActive || new Date(s.lastActive).getTime() < ctx.weekAgo
    case 'unanswered':
      return s.accuracy === null
    case 'top':
      return (
        s.accuracy !== null && s.accuracy >= 90 && s.studyHours >= ctx.avgHours
      )
  }
}

function PresetCards({
  counts,
  active,
  onSelect,
}: {
  counts: Record<Preset['key'], number>
  active: Preset['key']
  onSelect: (key: Preset['key']) => void
}) {
  return (
    <div className='grid gap-3 sm:grid-cols-3 xl:grid-cols-5'>
      {PRESETS.map((p, i) => {
        const on = active === p.key
        return (
          <button
            key={p.key}
            type='button'
            aria-pressed={on}
            onClick={() => onSelect(on && p.key !== 'all' ? 'all' : p.key)}
            className={cn(
              'group flex animate-in items-center gap-3 rounded-xl border bg-card p-4 text-start shadow-sm transition-all duration-300 fill-mode-both fade-in slide-in-from-bottom-2 hover:-translate-y-0.5 hover:shadow-md',
              on && 'border-primary ring-2 ring-primary/20'
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                toneClass[p.tone]
              )}
            >
              <p.icon className='size-5' />
            </span>
            <span className='min-w-0'>
              <span className='flex items-baseline gap-1.5'>
                <span className='text-sm text-muted-foreground'>{p.label}</span>
              </span>
              <span className='block text-2xl leading-tight font-bold tabular-nums'>
                <NumberTicker value={counts[p.key]} />
                <span className='ms-0.5 text-sm font-medium text-muted-foreground'>
                  人
                </span>
              </span>
              <span className='block truncate text-xs text-muted-foreground'>
                {p.desc}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Panel({
  title,
  desc,
  action,
  className,
  children,
}: {
  title: string
  desc: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className='flex-1'>{children}</CardContent>
    </Card>
  )
}

function Hint({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <span className='flex items-center gap-1 text-xs text-muted-foreground'>
      <Icon className='size-3.5' />
      {children}
    </span>
  )
}

export function LearningStats() {
  const { data: meta } = useMeta()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  // 班级下拉只列当前学期的授课班级（统计口径与后端一致）
  const semesterClasses = useMemo(
    () => (meta?.classes ?? []).filter((c) => c.inCurrentSemester),
    [meta?.classes]
  )
  // 班级筛选以地址栏为准；不是当前学期授课班级的忽略（meta 未加载时先按地址栏请求）
  const classId =
    search.classId !== undefined &&
    (!meta || semesterClasses.some((c) => c.id === search.classId))
      ? search.classId
      : undefined
  const klass = classId === undefined ? ALL : String(classId)
  const [sortKey, setSortKey] = useState<SortKey>('accuracy')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [adviceOpen, setAdviceOpen] = useState(false)
  // 打开详情抽屉的学生
  const [pickedId, setPickedId] = useState<string | null>(null)
  const scatterRef = useRef<echarts.ECharts | null>(null)

  const overview = useStatsOverview(classId)
  const studentsQuery = useStudentStats(classId)
  // 班级对比始终基于全部学生（与上方班级筛选无关）
  const allStudentsQuery = useStudentStats()
  const kpis = overview.data?.kpis
  const all = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])

  // 散点图只能画已作答的学生；顺序固定，供表格悬停联动定位
  const plotted = useMemo(
    () => all.filter((s): s is PlottedStudent => s.accuracy !== null),
    [all]
  )
  const plotIndex = useMemo(
    () => new Map(plotted.map((s, i) => [s.userId, i])),
    [plotted]
  )

  const classRows = useMemo(
    () => summarizeClasses(allStudentsQuery.data ?? [], meta?.classes ?? []),
    [allStudentsQuery.data, meta?.classes]
  )

  const students = useMemo(() => {
    const list = selection
      ? all.filter((s) => selection.ids.has(s.userId))
      : all
    // 没有作答（正确率为空）的学生排在最后
    return [...list].sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1))
  }, [all, selection, sortKey])

  // 分页：班级、筛选或排序变化时回到第 1 页（页码与筛选条件绑定，无需额外 effect）
  const filterKey = `${klass}|${sortKey}|${selection ? [...selection.ids].join(',') : ''}`
  const [pager, setPager] = useState({ key: filterKey, page: 1, size: 10 })
  const pageSize = pager.size
  const pageCount = Math.max(1, Math.ceil(students.length / pageSize))
  const page = pager.key === filterKey ? Math.min(pager.page, pageCount) : 1
  const pageRows = students.slice((page - 1) * pageSize, page * pageSize)
  const goPage = (p: number) =>
    setPager({ key: filterKey, page: p, size: pageSize })
  const changePageSize = (size: number) =>
    setPager({ key: filterKey, page: 1, size })

  const changeClass = useCallback(
    (value: string) => {
      void navigate({
        search: value === ALL ? {} : { classId: Number(value) },
        replace: true,
      })
      setSelection(null)
    },
    [navigate]
  )

  const onBrush = useCallback((ids: string[] | null) => {
    setSelection((cur) => {
      if (ids === null) return cur?.source === 'brush' ? null : cur
      return { source: 'brush', ids: new Set(ids) }
    })
  }, [])

  const onBand = useCallback(
    (band: number | null) => {
      // 点区间时清掉散点图上的框选，避免两种筛选叠在一起
      scatterRef.current?.dispatchAction({ type: 'brush', areas: [] })
      setSelection(
        band === null
          ? null
          : {
              source: 'band',
              band,
              ids: new Set(
                all
                  .filter(
                    (s) => s.accuracy !== null && inBand(s.accuracy, band)
                  )
                  .map((s) => s.userId)
              ),
            }
      )
    },
    [all]
  )

  // 「近 7 天」以打开页面的时刻为准
  const [weekAgo] = useState(() => Date.now() - 7 * 24 * 3600 * 1000)
  const presetCtx = useMemo(
    () => ({ avgHours: kpis?.avgStudyHours ?? 0, weekAgo }),
    [kpis?.avgStudyHours, weekAgo]
  )
  const presetCounts = useMemo(() => {
    const keys: PresetKey[] = ['attention', 'inactive', 'unanswered', 'top']
    return Object.fromEntries([
      ['all', all.length],
      ...keys.map((k) => [
        k,
        all.filter((st) => matchPreset(k, st, presetCtx)).length,
      ]),
    ]) as Record<Preset['key'], number>
  }, [all, presetCtx])

  const onPreset = (key: Preset['key']) => {
    scatterRef.current?.dispatchAction({ type: 'brush', areas: [] })
    setSelection(
      key === 'all'
        ? null
        : {
            source: 'preset',
            preset: key,
            ids: new Set(
              all
                .filter((st) => matchPreset(key, st, presetCtx))
                .map((st) => st.userId)
            ),
          }
    )
  }

  const clearSelection = () => {
    scatterRef.current?.dispatchAction({ type: 'brush', areas: [] })
    setSelection(null)
  }

  // 表格行悬停 → 散点图上对应学生高亮并显示提示
  const focusStudent = (userId: string | null) => {
    const chart = scatterRef.current
    if (!chart) return
    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 })
    if (userId === null) {
      chart.dispatchAction({ type: 'hideTip' })
      return
    }
    const dataIndex = plotIndex.get(userId)
    if (dataIndex === undefined) return
    chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex })
    chart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex })
  }

  // 框选时散点图自己会把框外的点变淡；其他筛选由这里传入要高亮的学生
  const highlightIds =
    selection && selection.source !== 'brush' ? selection.ids : null
  const selectionLabel = !selection
    ? null
    : selection.source === 'band'
      ? `正确率 ${ACCURACY_BANDS[selection.band].label}`
      : selection.source === 'preset'
        ? PRESETS.find((p) => p.key === selection.preset)?.label
        : '散点图框选'
  const scopeLabel =
    selectionLabel ??
    (classId === undefined
      ? '全部学生'
      : (meta?.classes.find((c) => c.id === classId)?.name ?? '当前班级'))

  return (
    <>
      <DefaultHeader />

      <Main className='space-y-4'>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <Select value={klass} onValueChange={changeClass}>
            <SelectTrigger className='w-52'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部班级</SelectItem>
              {semesterClasses.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {overview.isError && (
          <p className='text-sm text-destructive'>
            {apiErrorTitle(overview.error, '统计数据加载失败。')}
          </p>
        )}

        {/* ===== 学生分组：点击即筛选下方散点图与明细表 ===== */}
        <PresetCards
          counts={presetCounts}
          active={selection?.source === 'preset' ? selection.preset : 'all'}
          onSelect={onPreset}
        />

        {/* ===== 学生分布（框选）+ 正确率区间 / 班级对比（点击） ===== */}
        <div className='grid gap-4 lg:grid-cols-12'>
          <Panel
            title='学生学情分布'
            desc='横轴学习时长、纵轴正确率，点越大练习越多；虚线为平均值，红色闪烁为需关注学生'
            className='lg:col-span-8'
            action={<Hint icon={Target}>右上角工具可框选学生</Hint>}
          >
            {plotted.length > 0 ? (
              <StudentScatter
                students={plotted}
                avgHours={kpis?.avgStudyHours ?? 0}
                avgAccuracy={kpis?.avgAccuracy ?? null}
                highlightIds={highlightIds}
                onBrush={onBrush}
                onPick={setPickedId}
                onReady={(c) => (scatterRef.current = c)}
              />
            ) : (
              <p className='flex h-80 items-center justify-center text-sm text-muted-foreground'>
                暂无作答数据
              </p>
            )}
          </Panel>

          <div className='grid gap-4 lg:col-span-4'>
            <Panel title='正确率分布' desc='各区间学生人数，点击柱子筛选学生'>
              <AccuracyHistogram
                students={all}
                activeBand={
                  selection?.source === 'band' ? selection.band : null
                }
                onSelect={onBand}
              />
            </Panel>
            <Panel
              title='班级对比'
              desc='平均正确率 · 人均学时，点击切换到该班'
            >
              <ClassCompare
                rows={classRows}
                activeId={classId ?? null}
                onSelect={(id) => changeClass(id === null ? ALL : String(id))}
              />
            </Panel>
          </div>
        </div>

        {/* ===== 明细 ===== */}
        <Card>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
            <div className='space-y-1.5'>
              <CardTitle className='flex items-center gap-2'>
                学生学情明细
                {selectionLabel && (
                  <Badge variant='secondary' className='gap-1 font-normal'>
                    {selectionLabel} · {students.length} 人
                    <button
                      type='button'
                      aria-label='清除筛选'
                      className='rounded-sm hover:text-foreground'
                      onClick={clearSelection}
                    >
                      <X className='size-3' />
                    </button>
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                正确率低于 65% 或学习时长不足
                {kpis ? ` ${kpis.attentionHoursThreshold} ` : ' '}
                小时（按学期进度折算）的学生标记为「需关注」；鼠标移到某行可在散点图上定位，点击查看个人详情与
                AI 分析
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                className='gap-1.5 border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-sky-500/10 hover:from-violet-500/15 hover:to-sky-500/15'
                disabled={students.length === 0}
                onClick={() => setAdviceOpen(true)}
              >
                <Sparkles className='size-4 text-violet-500' />
                AI 分析
              </Button>
              {selection && (
                <Button variant='ghost' size='sm' onClick={clearSelection}>
                  显示全部
                </Button>
              )}
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(sortText) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {sortText[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead className='text-end'>学习时长(h)</TableHead>
                  <TableHead className='text-end'>练习题数</TableHead>
                  <TableHead className='w-40'>正确率</TableHead>
                  <TableHead className='text-end'>病例浏览</TableHead>
                  <TableHead className='text-end'>AI 判读</TableHead>
                  <TableHead>最近学习</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody onMouseLeave={() => focusStudent(null)}>
                {pageRows.map((s) => (
                  <StudentRow
                    key={s.userId}
                    s={s}
                    onHover={() => focusStudent(s.userId)}
                    onOpen={() => setPickedId(s.userId)}
                  />
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='h-20 text-center text-muted-foreground'
                    >
                      {selection ? '筛选范围内没有学生。' : '该班级暂无学生。'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {students.length > 0 && (
              <Pager
                total={students.length}
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPage={goPage}
                onPageSize={changePageSize}
              />
            )}
          </CardContent>
        </Card>
      </Main>

      <GroupAdviceDialog
        open={adviceOpen}
        onOpenChange={setAdviceOpen}
        userIds={students.map((s) => s.userId)}
        scopeLabel={scopeLabel}
        onPickStudent={(id) => {
          setAdviceOpen(false)
          setPickedId(id)
        }}
      />
      <StudentSheet userId={pickedId} onClose={() => setPickedId(null)} />
    </>
  )
}

function StudentRow({
  s,
  onHover,
  onOpen,
}: {
  s: StudentStat
  onHover: () => void
  onOpen: () => void
}) {
  return (
    <TableRow
      className='cursor-pointer'
      tabIndex={0}
      onMouseEnter={onHover}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <TableCell className='text-muted-foreground'>{s.id}</TableCell>
      <TableCell className='font-medium'>
        <span className='flex items-center gap-2'>
          {s.name}
          {s.needsAttention && <Badge variant='destructive'>需关注</Badge>}
        </span>
      </TableCell>
      <TableCell>{s.className ?? '—'}</TableCell>
      <TableCell className='text-end'>{s.studyHours}</TableCell>
      <TableCell className='text-end'>{s.practiceCount}</TableCell>
      <TableCell>
        {s.accuracy !== null ? (
          <div className='flex items-center gap-2'>
            <SimpleProgress
              value={s.accuracy}
              className='w-20'
              indicatorClassName={
                s.accuracy < 60 ? 'bg-destructive' : undefined
              }
            />
            <span className='text-sm'>{s.accuracy}%</span>
          </div>
        ) : (
          <span className='text-sm text-muted-foreground'>未作答</span>
        )}
      </TableCell>
      <TableCell className='text-end'>{s.caseViews}</TableCell>
      <TableCell className='text-end'>{s.aiReads}</TableCell>
      <TableCell className='text-muted-foreground'>
        {formatRelativeTime(s.lastActive)}
      </TableCell>
    </TableRow>
  )
}

const PAGE_SIZES = [10, 20, 50]

/** 明细表分页：左侧人数与每页条数，右侧页码 */
function Pager({
  total,
  page,
  pageCount,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number
  page: number
  pageCount: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
      <div className='flex items-center gap-3 text-sm text-muted-foreground'>
        <span>
          第 {from}–{to} 条，共 {total} 人
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSize(Number(v))}
        >
          <SelectTrigger className='h-8 w-28'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent side='top'>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} 条/页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pageCount > 1 && (
        <div className='flex items-center gap-1'>
          <Button
            variant='outline'
            className='size-8 p-0'
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <span className='sr-only'>上一页</span>
            <ChevronLeft className='size-4' />
          </Button>
          {getPageNumbers(page, pageCount).map((n, i) =>
            n === '...' ? (
              <span
                key={`dots-${i}`}
                className='px-1 text-sm text-muted-foreground'
              >
                …
              </span>
            ) : (
              <Button
                key={n}
                variant={n === page ? 'default' : 'outline'}
                className='h-8 min-w-8 px-2'
                onClick={() => onPage(n as number)}
              >
                {n}
              </Button>
            )
          )}
          <Button
            variant='outline'
            className='size-8 p-0'
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            <span className='sr-only'>下一页</span>
            <ChevronRight className='size-4' />
          </Button>
        </div>
      )}
    </div>
  )
}
