import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  ScanEye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { reportViewDuration, useCaseFullText, useRecordCaseView } from '../api'
import {
  datasetSource,
  difficultyClass,
  imageTypeLabels,
  patientLabel,
  type MedicalCase,
} from '../data/cases'

type Props = {
  data: MedicalCase | null
  onOpenChange: (open: boolean) => void
}

const licenseUrls: Record<string, string> = {
  'CC BY': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-NC': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC BY-NC-SA': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
}

export function CaseDetailSheet({ data, onOpenChange }: Props) {
  return (
    <Sheet open={!!data} onOpenChange={onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-2xl'>
        {data && <CaseDetail key={data.id} data={data} />}
      </SheetContent>
    </Sheet>
  )
}

/** 以 key={病例 id} 渲染，切换病例时状态自然重置 */
function CaseDetail({ data }: { data: MedicalCase }) {
  const { topic, images, source } = data
  const [index, setIndex] = useState(0)
  useTrackCaseView(data.id)
  const current = images[index]
  const go = (step: number) =>
    setIndex((i) => (i + step + images.length) % images.length)
  const licenseUrl = licenseUrls[source.license]

  return (
    <>
      <SheetHeader>
        <div className='flex items-center gap-2'>
          <SheetTitle>{topic.title}</SheetTitle>
          <Badge
            variant='outline'
            className={difficultyClass[topic.difficulty]}
          >
            {topic.difficulty}
          </Badge>
        </div>
        <SheetDescription>
          {data.id} · {topic.system} · {topic.modality} · {patientLabel(data)} ·{' '}
          {images.length} 幅影像
        </SheetDescription>
      </SheetHeader>

      <div className='flex-1 space-y-5 overflow-y-auto px-4 pb-4'>
        {current && (
          <div className='space-y-3'>
            <div className='relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-black'>
              <img
                key={current.url}
                src={current.url}
                alt={`${topic.title} 影像 ${index + 1}`}
                className='max-h-full max-w-full object-contain'
              />
              {images.length > 1 && (
                <>
                  <Button
                    size='icon'
                    variant='secondary'
                    className='absolute start-2 top-1/2 size-8 -translate-y-1/2 opacity-80'
                    onClick={() => go(-1)}
                    aria-label='上一张'
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size='icon'
                    variant='secondary'
                    className='absolute end-2 top-1/2 size-8 -translate-y-1/2 opacity-80'
                    onClick={() => go(1)}
                    aria-label='下一张'
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
              <span className='absolute end-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white'>
                {imageTypeLabels[current.type] ?? '图像'} · {index + 1} /{' '}
                {images.length}
              </span>
            </div>

            <p
              className='rounded-md border bg-muted/40 p-3 text-xs leading-relaxed'
              lang='en'
            >
              <span className='font-medium'>原始图注：</span>
              {current.caption || '（无图注）'}
            </p>

            {images.length > 1 && (
              <div className='grid grid-cols-5 gap-1.5'>
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type='button'
                    onClick={() => setIndex(i)}
                    aria-label={`查看第 ${i + 1} 张`}
                    className={cn(
                      'aspect-square overflow-hidden rounded bg-black ring-offset-background transition',
                      i === index
                        ? 'ring-2 ring-primary ring-offset-1'
                        : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    <img
                      src={img.url}
                      alt=''
                      loading='lazy'
                      className='size-full object-cover'
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <CaseText caseId={data.id} />

        <Separator />

        <div>
          <h3 className='mb-1 text-sm font-semibold'>
            病种要点 · {topic.title}
          </h3>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            {topic.summary}
          </p>
          <ol className='mt-2 list-decimal space-y-1 ps-5 text-sm text-muted-foreground'>
            {topic.keyPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <div className='mt-3 flex flex-wrap gap-1'>
            {topic.tags.map((t) => (
              <Badge key={t} variant='secondary'>
                {t}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className='space-y-1.5 text-xs text-muted-foreground'>
          <h3 className='text-sm font-semibold text-foreground'>病例出处</h3>
          <p>
            {source.authors.join(', ')}. {source.title}. <i>{source.journal}</i>{' '}
            {source.year}.
          </p>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <a
              href={`https://pmc.ncbi.nlm.nih.gov/articles/${source.pmcid}/`}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 underline underline-offset-4 hover:text-primary'
            >
              {source.pmcid}
              <ExternalLink className='size-3' />
            </a>
            <span>
              许可：
              {licenseUrl ? (
                <a
                  href={licenseUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='underline underline-offset-4 hover:text-primary'
                >
                  {source.license}
                </a>
              ) : (
                source.license
              )}
            </span>
          </div>
          <p>
            病例与影像经{' '}
            <a
              href={datasetSource.recordUrl}
              target='_blank'
              rel='noreferrer'
              className='underline underline-offset-4'
            >
              {datasetSource.name}
            </a>{' '}
            整理（DOI {datasetSource.paperDoi}
            ），版权归原作者所有，仅供教学使用，不得用于商业用途。
          </p>
        </div>
      </div>

      <SheetFooter className='flex-row justify-end border-t'>
        <Button variant='outline' asChild>
          <Link to='/question-bank'>
            <ClipboardList />
            相关练习
          </Link>
        </Button>
        <Button asChild>
          <Link to='/ai-reading'>
            <ScanEye />
            AI 判读
          </Link>
        </Button>
      </SheetFooter>
    </>
  )
}

/** 打开病例时记录一次浏览，关闭时上报停留时长（学情统计使用） */
function useTrackCaseView(caseId: string) {
  const { mutate } = useRecordCaseView()
  const viewId = useRef<number | null>(null)
  useEffect(() => {
    const openedAt = Date.now()
    mutate(caseId, { onSuccess: (id) => (viewId.current = id) })
    return () => {
      const seconds = Math.round((Date.now() - openedAt) / 1000)
      if (viewId.current !== null && seconds > 0) {
        void reportViewDuration(viewId.current, seconds)
      }
    }
  }, [caseId, mutate])
}

/** 病例原文（英文），首次打开详情时从后端加载 */
function CaseText({ caseId }: { caseId: string }) {
  const { data: text, isLoading, isError } = useCaseFullText(caseId)

  return (
    <div>
      <h3 className='mb-1 text-sm font-semibold'>病例原文（英文）</h3>
      {isLoading ? (
        <p className='text-xs text-muted-foreground'>正在加载病例原文…</p>
      ) : isError || !text ? (
        <p className='text-xs text-muted-foreground'>暂无病例原文。</p>
      ) : (
        <p
          className='text-sm leading-relaxed whitespace-pre-line text-muted-foreground'
          lang='en'
        >
          {text}
        </p>
      )}
    </div>
  )
}
