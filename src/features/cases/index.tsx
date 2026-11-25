import { useMemo, useState } from 'react'
import { Eye, Images, Search as SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { CaseDetailSheet } from './components/case-detail-sheet'
import {
  caseDifficulties,
  caseModalities,
  cases,
  caseSystems,
  difficultyClass,
  type MedicalCase,
} from './data/cases'

const ALL = 'all'

export function Cases() {
  const [keyword, setKeyword] = useState('')
  const [system, setSystem] = useState<string>(ALL)
  const [modality, setModality] = useState<string>(ALL)
  const [difficulty, setDifficulty] = useState<string>(ALL)
  const [current, setCurrent] = useState<MedicalCase | null>(null)

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return cases.filter(
      (c) =>
        (system === ALL || c.system === system) &&
        (modality === ALL || c.modality === modality) &&
        (difficulty === ALL || c.difficulty === difficulty) &&
        (!kw ||
          c.title.toLowerCase().includes(kw) ||
          c.id.toLowerCase().includes(kw) ||
          c.tags.some((t) => t.toLowerCase().includes(kw)))
    )
  }, [keyword, system, modality, difficulty])

  return (
    <>
      <DefaultHeader />

      <Main fixed>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>病例库浏览</h1>
          <p className='text-muted-foreground'>
            按系统、检查类型与难度检索教学病例，查看影像表现与诊断要点。
          </p>
        </div>

        <div className='my-4 flex flex-wrap items-center gap-3'>
          <div className='relative'>
            <SearchIcon className='absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='搜索病例名称 / 编号 / 标签…'
              className='h-9 w-64 ps-8'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <FilterSelect
            value={system}
            onChange={setSystem}
            placeholder='全部系统'
            options={caseSystems}
          />
          <FilterSelect
            value={modality}
            onChange={setModality}
            placeholder='全部检查'
            options={caseModalities}
          />
          <FilterSelect
            value={difficulty}
            onChange={setDifficulty}
            placeholder='全部难度'
            options={caseDifficulties}
          />
          <span className='ms-auto text-sm text-muted-foreground'>
            共 {filtered.length} 个病例
          </span>
        </div>

        <Separator className='shadow-sm' />

        {filtered.length === 0 ? (
          <div className='flex flex-1 items-center justify-center text-muted-foreground'>
            没有符合条件的病例
          </div>
        ) : (
          <ul className='faded-bottom no-scrollbar grid gap-4 overflow-auto pt-4 pb-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type='button'
                  onClick={() => setCurrent(c)}
                  className='w-full rounded-lg border p-3 text-start transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                >
                  <MedicalImagePlaceholder
                    label={`${c.modality} · ${c.system}`}
                  />
                  <div className='mt-3 flex items-start justify-between gap-2'>
                    <h2 className='line-clamp-1 font-semibold'>{c.title}</h2>
                    <Badge
                      variant='outline'
                      className={difficultyClass[c.difficulty]}
                    >
                      {c.difficulty}
                    </Badge>
                  </div>
                  <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                    {c.chiefComplaint}
                  </p>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {c.tags.map((t) => (
                      <Badge key={t} variant='secondary'>
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
                    <span>{c.id}</span>
                    <span className='flex items-center gap-3'>
                      <span className='flex items-center gap-1'>
                        <Images className='size-3.5' />
                        {c.imageCount}
                      </span>
                      <span className='flex items-center gap-1'>
                        <Eye className='size-3.5' />
                        {c.views}
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Main>

      <CaseDetailSheet
        data={current}
        onOpenChange={(open) => !open && setCurrent(null)}
      />
    </>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className='h-9 w-32'>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
