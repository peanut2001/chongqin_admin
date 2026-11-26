import { useMemo, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Search as SearchIcon,
} from 'lucide-react'
import { getPageNumbers } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { MedicalImagePlaceholder } from '@/components/medical-image-placeholder'
import { useMedicalCases } from './api'
import { CaseDetailSheet } from './components/case-detail-sheet'
import {
  caseDifficulties,
  caseModalities,
  caseSystems,
  datasetSource,
  difficultyClass,
  patientLabel,
  type MedicalCase,
} from './data/cases'

const ALL = 'all'
/** 每页病例数（4 列 × 3 行），只渲染当前页的封面图，避免一次请求过多图片 */
const PAGE_SIZE = 12
const route = getRouteApi('/_authenticated/cases/')

export function Cases() {
  const [keyword, setKeyword] = useState('')
  const [topicId, setTopicId] = useState<string>(ALL)
  const [system, setSystem] = useState<string>(ALL)
  const [modality, setModality] = useState<string>(ALL)
  const [difficulty, setDifficulty] = useState<string>(ALL)
  const [page, setPage] = useState(1)
  const listRef = useRef<HTMLUListElement>(null)
  // 筛选条件变化时回到第 1 页
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }
  const { cases, topics, isLoading, isError } = useMedicalCases()
  // 当前打开的病例记在地址栏 ?case=，可直接分享/从题库跳转，浏览器后退即关闭
  const { case: openCaseId } = route.useSearch()
  const navigate = route.useNavigate()
  const current = cases.find((c) => c.id === openCaseId) ?? null
  const setCurrent = (c: MedicalCase | null) =>
    navigate({ search: c ? { case: c.id } : {}, replace: !c })

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return cases.filter(
      (c) =>
        (topicId === ALL || c.topicId === topicId) &&
        (system === ALL || c.topic.system === system) &&
        (modality === ALL || c.topic.modality === modality) &&
        (difficulty === ALL || c.topic.difficulty === difficulty) &&
        (!kw ||
          c.topic.title.toLowerCase().includes(kw) ||
          c.id.toLowerCase().includes(kw) ||
          c.topic.tags.some((t) => t.toLowerCase().includes(kw)) ||
          c.excerpt.toLowerCase().includes(kw) ||
          c.source.title.toLowerCase().includes(kw))
    )
  }, [cases, keyword, topicId, system, modality, difficulty])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageCases = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )
  const goPage = (p: number) => {
    setPage(p)
    listRef.current?.scrollTo({ top: 0 })
  }

  return (
    <>
      <DefaultHeader />

      <Main fixed>
        <div className='mb-4 flex flex-wrap items-center gap-3'>
          <div className='relative'>
            <SearchIcon className='absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='搜索病种 / 编号 / 标签 / 英文关键词…'
              className='h-9 w-64 ps-8'
              value={keyword}
              onChange={(e) => withReset(setKeyword)(e.target.value)}
            />
          </div>
          <FilterSelect
            value={topicId}
            onChange={withReset(setTopicId)}
            placeholder='全部病种'
            options={topics.map((t) => ({
              value: t.id,
              label: t.title,
            }))}
            className='w-40'
          />
          <FilterSelect
            value={system}
            onChange={withReset(setSystem)}
            placeholder='全部系统'
            options={caseSystems}
          />
          <FilterSelect
            value={modality}
            onChange={withReset(setModality)}
            placeholder='全部检查'
            options={caseModalities}
          />
          <FilterSelect
            value={difficulty}
            onChange={withReset(setDifficulty)}
            placeholder='全部难度'
            options={caseDifficulties}
          />
          <span className='ms-auto text-sm text-muted-foreground'>
            共 {filtered.length} 个病例 · 来源{' '}
            <a
              href={datasetSource.recordUrl}
              target='_blank'
              rel='noreferrer'
              title='PubMed Central 开放获取病例报告，仅供教学使用'
              className='underline underline-offset-4 hover:text-primary'
            >
              {datasetSource.name}
            </a>
          </span>
        </div>

        <Separator className='shadow-sm' />

        {filtered.length === 0 ? (
          <div className='flex flex-1 items-center justify-center text-muted-foreground'>
            {isLoading
              ? '正在加载病例…'
              : isError
                ? '病例加载失败，请刷新重试。'
                : '没有符合条件的病例'}
          </div>
        ) : (
          <>
            <ul
              ref={listRef}
              className='no-scrollbar grid flex-1 content-start gap-4 overflow-auto py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            >
              {pageCases.map((c) => (
                <li key={c.id}>
                  <CaseCard data={c} onOpen={() => setCurrent(c)} />
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <CasePagination
                page={currentPage}
                totalPages={totalPages}
                onChange={goPage}
              />
            )}
          </>
        )}
      </Main>

      <CaseDetailSheet
        data={current}
        onOpenChange={(open) => !open && setCurrent(null)}
      />
    </>
  )
}

function CaseCard({
  data: c,
  onOpen,
}: {
  data: MedicalCase
  onOpen: () => void
}) {
  const cover = c.images[c.coverIndex] ?? c.images[0]
  const label = `${c.topic.modality} · ${c.topic.system}`
  return (
    <button
      type='button'
      onClick={onOpen}
      className='w-full rounded-lg border p-3 text-start transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
    >
      {cover ? (
        <div className='relative aspect-[4/3] overflow-hidden rounded-md bg-black'>
          <img
            src={cover.url}
            alt={c.topic.title}
            loading='lazy'
            className='size-full object-cover'
          />
          <span className='absolute start-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white'>
            {label}
          </span>
        </div>
      ) : (
        <MedicalImagePlaceholder label={label} />
      )}
      <div className='mt-3 flex items-start justify-between gap-2'>
        <h2 className='line-clamp-1 font-semibold'>{c.topic.title}</h2>
        <Badge
          variant='outline'
          className={difficultyClass[c.topic.difficulty]}
        >
          {c.topic.difficulty}
        </Badge>
      </div>
      <p className='mt-0.5 text-sm'>{patientLabel(c)}</p>
      <p className='mt-1 line-clamp-2 text-xs text-muted-foreground' lang='en'>
        {c.excerpt}
      </p>
      <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
        <span>{c.id}</span>
        <span className='flex items-center gap-1' title='影像数'>
          <Images className='size-3.5' />
          {c.images.length}
        </span>
      </div>
    </button>
  )
}

function CasePagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  return (
    <nav
      aria-label='病例分页'
      className='flex items-center justify-center gap-2 border-t pt-3'
    >
      <Button
        variant='outline'
        className='size-8 p-0'
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        <span className='sr-only'>上一页</span>
        <ChevronLeft className='size-4' />
      </Button>
      {getPageNumbers(page, totalPages).map((n, i) =>
        n === '...' ? (
          <span
            key={`dots-${i}`}
            className='px-1 text-sm text-muted-foreground'
          >
            ...
          </span>
        ) : (
          <Button
            key={n}
            variant={n === page ? 'default' : 'outline'}
            className='h-8 min-w-8 px-2'
            onClick={() => onChange(n as number)}
          >
            {n}
          </Button>
        )
      )}
      <Button
        variant='outline'
        className='size-8 p-0'
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        <span className='sr-only'>下一页</span>
        <ChevronRight className='size-4' />
      </Button>
      <span className='ms-2 text-sm text-muted-foreground'>
        第 {page} / {totalPages} 页
      </span>
    </nav>
  )
}

type Option = string | { value: string; label: string }

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className = 'w-32',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: Option[]
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => {
          const { value: v, label } =
            typeof o === 'string' ? { value: o, label: o } : o
          return (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
