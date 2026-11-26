import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  History,
  ImagePlus,
  LoaderCircle,
  ScanEye,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { canViewClassData } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { MedicalImagePlaceholder } from '@/components/medical-image-placeholder'
import { SimpleProgress } from '@/components/simple-progress'
import {
  useAiReadings,
  useAiSamples,
  useCreateReading,
  useSetAgreement,
} from './api'
import {
  agreements,
  type Agreement,
  type AiReading as Reading,
  type AiResult,
} from './data/samples'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
const PAGE_SIZE = 20
/** 示例影像下拉框中「本地上传」对应的值 */
const UPLOAD_VALUE = '__upload__'

/**
 * 各栏统一高度：占满一屏（减去顶栏、标题与边距），栏内各自滚动。
 * 须写成完整类名，Tailwind 才能扫描生成样式。
 */
const PANEL_H_LG = 'lg:h-[calc(100svh-12.25rem)] lg:min-h-[560px]'
const PANEL_H_XL = 'xl:h-[calc(100svh-12.25rem)] xl:min-h-[560px]'

const agreementClass: Record<Agreement, string> = {
  一致: 'text-emerald-600',
  部分一致: 'text-amber-600',
  不一致: 'text-rose-600',
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function AiReading() {
  const { data: meta } = useAiSamples()
  const samples = meta?.samples ?? []
  const modalities = meta?.modalities ?? []

  // undefined：尚未选择，默认第一个示例；null：已切换为上传图片
  const [pickedSampleId, setPickedSampleId] = useState<string | null>()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadModality, setUploadModality] = useState<string>()
  const [opinion, setOpinion] = useState('')
  const [reading, setReading] = useState<Reading | null>(null)
  // 判读记录默认收起，点击标题栏右侧的图标展开
  const [showHistory, setShowHistory] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = useCreateReading()
  const agree = useSetAgreement()

  const sampleId =
    pickedSampleId === undefined ? samples[0]?.id : pickedSampleId
  const sample = samples.find((s) => s.id === sampleId)
  const modality = sample?.modality ?? uploadModality ?? modalities[0] ?? ''

  // 释放上传图片的 object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const pickSample = (id: string) => {
    if (id === UPLOAD_VALUE) {
      fileRef.current?.click()
      return
    }
    setReading(null)
    setFile(null)
    setPreviewUrl(null)
    setPickedSampleId(id)
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!ACCEPT.split(',').includes(f.type)) {
      toast.error('仅支持 PNG、JPEG、WebP、GIF 图片。')
      return
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error('图片不能超过 8MB。')
      return
    }
    setReading(null)
    setPickedSampleId(null)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const opinionReady = opinion.trim().length >= 2
  const hasImage = !!sample || !!file

  const analyze = () =>
    create.mutate(
      {
        sampleId: sample?.id,
        file: sample ? undefined : (file ?? undefined),
        modality,
        opinion: opinion.trim(),
      },
      { onSuccess: setReading }
    )

  const setAgreement = (agreement: Agreement) => {
    if (!reading) return
    agree.mutate(
      { id: reading.id, agreement },
      { onSuccess: (r) => setReading(r) }
    )
  }

  const result = reading?.result ?? null
  const engineModel = meta?.engine.mode === 'model' ? meta.engine.model : null

  return (
    <>
      <DefaultHeader />

      <Main fluid className='space-y-4'>
        {/* ===== 标题 + 当前判读引擎 ===== */}
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>AI 图像判读</h1>
            <p className='text-sm text-muted-foreground'>
              先独立写下判读意见，再与 AI 辅助结果对照学习。
              {engineModel
                ? 'AI 结果可能有误，仅供教学参考，不可用于临床诊断。'
                : '当前未启用 AI 模型，判读结果为演示数据，不可用于临床诊断。'}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {meta && (
              <Badge
                variant='outline'
                className={cn(
                  'h-8 gap-1',
                  !engineModel && 'border-amber-500 text-amber-600'
                )}
              >
                <Sparkles className='size-3.5' />
                {engineModel ?? '演示模式'}
              </Badge>
            )}
            <Button
              size='icon'
              variant={showHistory ? 'default' : 'outline'}
              className='size-8'
              aria-label={showHistory ? '收起判读记录' : '展开判读记录'}
              aria-pressed={showHistory}
              title={showHistory ? '收起判读记录' : '判读记录'}
              onClick={() => setShowHistory((v) => !v)}
            >
              <History />
            </Button>
          </div>
        </div>

        {/* 宽屏：影像 | 判读步骤 | 判读记录（默认收起）；中屏：判读记录在下方 */}
        <div
          className={cn(
            'grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]',
            showHistory
              ? 'xl:grid-cols-[minmax(0,1fr)_380px_320px]'
              : 'xl:grid-cols-[minmax(0,1fr)_420px]'
          )}
        >
          {/* ===== 影像 ===== */}
          <Card className={cn('gap-3 p-4 lg:flex lg:flex-col', PANEL_H_LG)}>
            <div className='flex flex-wrap items-end gap-2'>
              <div className='min-w-48 flex-1 space-y-1.5'>
                <Label className='text-xs text-muted-foreground'>影像</Label>
                <Select
                  value={sample ? sample.id : UPLOAD_VALUE}
                  onValueChange={pickSample}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='选择示例影像' />
                  </SelectTrigger>
                  <SelectContent>
                    {samples.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={UPLOAD_VALUE}>
                      {file ? `本地图片：${file.name}` : '上传本地图片…'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='w-40 space-y-1.5'>
                <Label className='text-xs text-muted-foreground'>
                  检查类型
                </Label>
                <Select
                  value={modality}
                  onValueChange={setUploadModality}
                  disabled={!!sample}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modalities.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant='outline'
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus />
                上传图片
              </Button>
              <input
                ref={fileRef}
                type='file'
                accept={ACCEPT}
                className='hidden'
                onChange={onUpload}
              />
            </div>

            <FittedImage
              url={sample ? sample.imageUrl : previewUrl}
              label={sample?.name ?? modality}
              result={result}
            />
          </Card>

          {/* ===== ① 判读意见 → ② AI 结果 → ③ 自评 ===== */}
          <Card
            className={cn(
              'gap-0 overflow-hidden py-0 lg:flex lg:flex-col',
              PANEL_H_LG
            )}
          >
            <Step index={1} title='我的判读意见' className='shrink-0'>
              <Textarea
                id='opinion'
                rows={4}
                maxLength={2000}
                placeholder='请先独立描述影像所见与初步诊断…'
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
              />
              <div className='flex items-center justify-between gap-2'>
                <span className='text-xs text-muted-foreground'>
                  {opinionReady
                    ? '判读意见与自评会保存，用于学情统计'
                    : '填写后才能查看 AI 结果'}
                </span>
                <Button
                  disabled={!hasImage || !opinionReady || create.isPending}
                  onClick={analyze}
                >
                  {create.isPending ? (
                    <LoaderCircle className='animate-spin' />
                  ) : (
                    <ScanEye />
                  )}
                  {create.isPending ? '判读中…' : '开始 AI 判读'}
                </Button>
              </div>
            </Step>

            <Separator />

            <div className='min-h-0 flex-1 overflow-y-auto'>
              <Step
                index={2}
                title='AI 判读结果'
                extra={
                  reading &&
                  !create.isPending &&
                  (reading.isDemo ? (
                    <Badge
                      variant='outline'
                      className='border-amber-500 text-amber-600'
                    >
                      演示结果
                    </Badge>
                  ) : (
                    <span className='text-xs text-muted-foreground'>
                      耗时 {(reading.result.elapsedMs / 1000).toFixed(1)} 秒
                    </span>
                  ))
                }
              >
                {create.isPending ? (
                  <Empty>
                    <LoaderCircle className='me-2 size-4 animate-spin' />
                    AI 分析中，通常需要 5～30 秒…
                  </Empty>
                ) : !reading || !result ? (
                  <Empty>写下判读意见后，点击「开始 AI 判读」</Empty>
                ) : (
                  <ResultView result={result} />
                )}
              </Step>
            </div>

            {reading && result && !create.isPending && (
              <>
                <Separator />
                <Step
                  index={3}
                  title='与 AI 结论的一致程度'
                  className='shrink-0'
                >
                  <div className='grid grid-cols-3 gap-2'>
                    {agreements.map((a) => (
                      <Button
                        key={a}
                        size='sm'
                        variant={
                          reading.agreement === a ? 'default' : 'outline'
                        }
                        disabled={agree.isPending}
                        onClick={() => setAgreement(a)}
                      >
                        {a}
                      </Button>
                    ))}
                  </div>
                </Step>
              </>
            )}
          </Card>

          {/* ===== 判读记录（默认收起） ===== */}
          {showHistory && (
            <HistoryPanel
              className={cn(
                'h-[480px] lg:col-span-2 xl:col-span-1',
                PANEL_H_XL
              )}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      </Main>
    </>
  )
}

function Step({
  index,
  title,
  extra,
  className,
  children,
}: {
  index: number
  title: string
  extra?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('space-y-3 p-4', className)}>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          <span className='flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground'>
            {index}
          </span>
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex h-40 items-center justify-center text-center text-sm text-muted-foreground'>
      {children}
    </div>
  )
}

function ResultView({ result }: { result: AiResult }) {
  return (
    <div className='space-y-4'>
      <div className='space-y-2.5'>
        <h3 className='text-xs font-medium text-muted-foreground'>异常发现</h3>
        {result.findings.length === 0 && (
          <p className='text-sm'>未发现明确异常。</p>
        )}
        {result.findings.map((f, i) => (
          <div key={`${i}-${f.label}`} className='space-y-1'>
            <div className='flex items-start justify-between gap-3 text-sm'>
              <span className='flex gap-1.5'>
                <span className='mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm bg-rose-500 text-[10px] text-white'>
                  {i + 1}
                </span>
                {f.label}
              </span>
              <span className='shrink-0 text-muted-foreground tabular-nums'>
                {(f.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <SimpleProgress
              value={f.confidence * 100}
              className='h-1.5'
              indicatorClassName={cn(
                f.confidence >= 0.85
                  ? 'bg-rose-500'
                  : f.confidence >= 0.7
                    ? 'bg-amber-500'
                    : 'bg-sky-500'
              )}
            />
          </div>
        ))}
      </div>

      <div className='space-y-1'>
        <h3 className='text-xs font-medium text-muted-foreground'>提示意见</h3>
        <p className='text-sm leading-relaxed'>{result.impression}</p>
      </div>

      {result.suggestions.length > 0 && (
        <div className='space-y-1'>
          <h3 className='text-xs font-medium text-muted-foreground'>
            学习建议
          </h3>
          <ul className='list-disc space-y-1 ps-5 text-sm leading-relaxed'>
            {result.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function HistoryPanel({
  className,
  onClose,
}: {
  className?: string
  onClose: () => void
}) {
  const role = useAuthStore((s) => s.auth.user?.role)
  // 教师 / 管理员看到全部学生的记录，需显示学生姓名
  const showStudent = canViewClassData(role)
  const [page, setPage] = useState(1)
  const records = useAiReadings(page, PAGE_SIZE)
  const total = records.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = records.data?.items ?? []

  return (
    <Card className={cn('flex flex-col gap-0 overflow-hidden py-0', className)}>
      <div className='flex shrink-0 items-center justify-between gap-2 p-4 pb-3'>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          <History className='size-4' />
          判读记录
        </h2>
        <div className='flex items-center gap-1'>
          <span className='text-xs text-muted-foreground'>共 {total} 条</span>
          <Button
            size='icon'
            variant='ghost'
            className='size-7'
            aria-label='收起判读记录'
            title='收起'
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <Separator />

      <div className='min-h-0 flex-1 space-y-2 overflow-y-auto p-3'>
        {items.map((r) => (
          <div key={r.id} className='space-y-1 rounded-md border p-2.5'>
            <div className='flex items-center justify-between gap-2 text-sm'>
              <span className='truncate font-medium'>
                {showStudent && r.student ? `${r.student} · ` : ''}
                {r.sample}
              </span>
              <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
                {dateFmt.format(new Date(r.createdAt))}
              </span>
            </div>
            <p
              className='line-clamp-2 text-xs leading-relaxed text-muted-foreground'
              title={r.result.impression}
            >
              {r.isDemo && (
                <Badge variant='outline' className='me-1 px-1 py-0 text-[10px]'>
                  演示
                </Badge>
              )}
              {r.result.impression}
            </p>
            <p
              className={cn(
                'text-xs',
                r.agreement
                  ? agreementClass[r.agreement]
                  : 'text-muted-foreground'
              )}
            >
              {r.agreement ?? '未自评'}
            </p>
          </div>
        ))}
        {records.data && items.length === 0 && <Empty>还没有判读记录。</Empty>}
      </div>

      {totalPages > 1 && (
        <>
          <Separator />
          <div className='flex shrink-0 items-center justify-between px-3 py-2 text-xs text-muted-foreground'>
            <span>
              第 {page} / {totalPages} 页
            </span>
            <div className='flex gap-1'>
              <Button
                size='icon'
                variant='outline'
                className='size-7'
                aria-label='上一页'
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                size='icon'
                variant='outline'
                className='size-7'
                aria-label='下一页'
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

/** 影像按所在区域等比缩放（尽量撑满），标注框叠加在图像上，单位为图像宽高百分比 */
function FittedImage({
  url,
  label,
  result,
}: {
  url: string | null
  label: string
  result: AiResult | null
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState<{ w: number; h: number } | null>(null)
  // 记录图像原始尺寸时带上 url，切换图像后旧尺寸自动失效
  const [natural, setNatural] = useState<{
    url: string
    w: number
    h: number
  } | null>(null)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setArea({ w: entry.contentRect.width, h: entry.contentRect.height })
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const nat = natural && natural.url === url ? natural : null
  const scale = area && nat ? Math.min(area.w / nat.w, area.h / nat.h) : 0
  const size = scale
    ? { width: nat!.w * scale, height: nat!.h * scale }
    : undefined

  // 编号与「异常发现」列表一致；没有定位框的所见不画框
  const boxes = result?.findings.map(
    (f, i) =>
      f.box && (
        <div
          key={`${i}-${f.label}`}
          className='absolute rounded-sm border-2 border-rose-500 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]'
          style={{
            left: `${f.box.x}%`,
            top: `${f.box.y}%`,
            width: `${f.box.w}%`,
            height: `${f.box.h}%`,
          }}
        >
          <span className='absolute -top-5 left-0 rounded-sm bg-rose-500 px-1 text-[10px] text-white'>
            {i + 1}
          </span>
        </div>
      )
  )

  return (
    <div
      ref={areaRef}
      className='relative flex h-[55vh] min-h-0 items-center justify-center overflow-hidden rounded-md bg-black lg:h-auto lg:flex-1'
    >
      {url ? (
        <div className={cn('relative', !size && 'invisible')} style={size}>
          <img
            key={url}
            src={url}
            alt={label}
            className='block size-full'
            onLoad={(e) =>
              setNatural({
                url,
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
          />
          <div className='pointer-events-none absolute inset-0'>{boxes}</div>
        </div>
      ) : (
        <MedicalImagePlaceholder label={label} className='size-full'>
          {boxes}
        </MedicalImagePlaceholder>
      )}
    </div>
  )
}
