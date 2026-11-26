import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDot,
  CircleX,
  Contrast,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  Lightbulb,
  LoaderCircle,
  Maximize,
  PartyPopper,
  PenLine,
  RotateCcw,
  ScanEye,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { canViewClassData } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DefaultHeader } from '@/components/layout/default-header'
import { Main } from '@/components/layout/main'
import { MedicalImagePlaceholder } from '@/components/medical-image-placeholder'
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

/**
 * 工作区占满一屏（减去顶栏、标题栏与边距），面板内各自滚动。
 * 须写成完整类名，Tailwind 才能扫描生成样式。
 */
const WORKSPACE_H = 'lg:h-[calc(100svh-11.5rem)] lg:min-h-[600px]'

const agreementStyle: Record<
  Agreement,
  { icon: LucideIcon; text: string; active: string }
> = {
  一致: {
    icon: CircleCheck,
    text: 'text-emerald-600',
    active:
      'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  部分一致: {
    icon: CircleDot,
    text: 'text-amber-600',
    active:
      'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  不一致: {
    icon: CircleX,
    text: 'text-rose-600',
    active:
      'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const OPINION_PLACEHOLDER = `请先独立读片，再查看 AI 结果。例如：
影像所见：右肺上叶见一类圆形结节，边缘可见毛刺…
初步诊断：考虑周围型肺癌，需与结核球鉴别`

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
  const [showHistory, setShowHistory] = useState(false)
  // 查看器工具
  const [showBoxes, setShowBoxes] = useState(true)
  const [invert, setInvert] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const opinionRef = useRef<HTMLTextAreaElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  const create = useCreateReading()
  const agree = useSetAgreement()

  const sampleId =
    pickedSampleId === undefined ? samples[0]?.id : pickedSampleId
  const sample = samples.find((s) => s.id === sampleId)
  const modality = sample?.modality ?? uploadModality ?? modalities[0] ?? ''
  const imageName = sample?.name ?? file?.name ?? '本地影像'

  // 释放上传图片的 object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const resetReading = () => {
    setReading(null)
    setShowBoxes(true)
  }
  // 换影像：判读意见针对的是上一张，一并清空
  const startNew = () => {
    resetReading()
    setOpinion('')
  }

  const pickSample = (id: string) => {
    if (id === sampleId) return
    startNew()
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
    startNew()
    setPickedSampleId(null)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const opinionReady = opinion.trim().length >= 2
  const hasImage = !!sample || !!file
  const canAnalyze = hasImage && opinionReady && !create.isPending

  const analyze = () =>
    create.mutate(
      {
        sampleId: sample?.id,
        file: sample ? undefined : (file ?? undefined),
        modality,
        opinion: opinion.trim(),
      },
      {
        onSuccess: (r) => {
          setReading(r)
          setShowBoxes(true)
        },
      }
    )

  const setAgreement = (agreement: Agreement) => {
    if (!reading) return
    agree.mutate(
      { id: reading.id, agreement },
      { onSuccess: (r) => setReading(r) }
    )
  }

  // 下一张示例影像（循环）；当前是上传图片时从第一张开始
  const nextSample = samples.length
    ? samples[sample ? (samples.indexOf(sample) + 1) % samples.length : 0]
    : undefined
  const goNext = () => {
    if (!nextSample) {
      fileRef.current?.click()
      return
    }
    pickSample(nextSample.id)
    requestAnimationFrame(() => opinionRef.current?.focus())
  }
  // 修改判读意见后对同一张影像重新判读（保留原意见，方便在此基础上修改）
  const retry = () => {
    resetReading()
    requestAnimationFrame(() => opinionRef.current?.focus())
  }

  const fullscreen = () => {
    const el = viewerRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }

  const result = create.isPending ? null : (reading?.result ?? null)
  const engineModel = meta?.engine.mode === 'model' ? meta.engine.model : null
  const boxCount = result?.findings.filter((f) => f.box).length ?? 0
  // 当前步骤：1 独立判读 → 2 AI 判读 → 3 对照自评（自评后全部完成）
  const step = !reading || create.isPending ? (create.isPending ? 2 : 1) : 3
  const done = !!reading?.agreement && !create.isPending

  return (
    <>
      <DefaultHeader />

      <Main className='space-y-4'>
        {/* ===== 标题栏：流程步骤 + 判读引擎 + 判读记录 ===== */}
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
          <div className='flex items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm'>
              <ScanEye className='size-5' />
            </span>
            <div>
              <h1 className='text-lg leading-tight font-semibold'>
                AI 影像判读
              </h1>
              <p className='text-xs text-muted-foreground'>
                先独立读片写下判读意见，再与 AI 结果对照
              </p>
            </div>
          </div>

          <Stepper step={step} done={done} />

          <div className='ms-auto flex items-center gap-2'>
            {meta && <EngineStatus model={engineModel} />}
            <Button variant='outline' onClick={() => setShowHistory(true)}>
              <History />
              判读记录
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]',
            WORKSPACE_H
          )}
        >
          {/* ===== 影像查看器 ===== */}
          <Card className='min-h-0 gap-0 overflow-hidden border-zinc-800 bg-zinc-950 py-0 text-zinc-100 lg:flex lg:flex-col'>
            {/* 工具栏 */}
            <div className='flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2'>
              <span className='flex min-w-0 items-center gap-2'>
                <Badge className='shrink-0 border-0 bg-white/10 text-zinc-100'>
                  {modality || '—'}
                </Badge>
                <span className='truncate text-sm font-medium'>
                  {imageName}
                </span>
              </span>
              {!sample && file && (
                <Select value={modality} onValueChange={setUploadModality}>
                  <SelectTrigger
                    size='sm'
                    className='h-7 w-32 border-white/15 bg-white/5 text-xs text-zinc-100'
                  >
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
              )}
              <div className='ms-auto flex items-center gap-1'>
                <ToolButton
                  label={showBoxes ? '隐藏 AI 标注' : '显示 AI 标注'}
                  active={showBoxes && boxCount > 0}
                  disabled={boxCount === 0}
                  onClick={() => setShowBoxes((v) => !v)}
                >
                  {showBoxes ? <Eye /> : <EyeOff />}
                </ToolButton>
                <ToolButton
                  label='反色'
                  active={invert}
                  onClick={() => setInvert((v) => !v)}
                >
                  <Contrast />
                </ToolButton>
                <ToolButton label='全屏查看' onClick={fullscreen}>
                  <Maximize />
                </ToolButton>
              </div>
            </div>

            {/* 影像 */}
            <div
              ref={viewerRef}
              className='relative flex h-[55vh] min-h-0 bg-black lg:h-auto lg:flex-1'
            >
              <FittedImage
                url={sample ? sample.imageUrl : previewUrl}
                label={imageName}
                result={showBoxes ? result : null}
                scanning={create.isPending}
                invert={invert}
              />
              {/* 四角信息（与常见阅片软件一致） */}
              <div className='pointer-events-none absolute inset-x-3 top-2 flex justify-between text-[11px] leading-relaxed text-zinc-300/90 tabular-nums'>
                <span>
                  {modality}
                  <br />
                  {sample ? `示例 ${sample.id}` : '本地上传'}
                </span>
                <span className='text-end'>
                  {invert ? '反色' : '常规'}
                  <br />
                  {engineModel ? 'AI 模型' : '演示模式'}
                </span>
              </div>
              <div className='pointer-events-none absolute inset-x-3 bottom-2 flex justify-between text-[11px] text-zinc-300/90'>
                <span>
                  {result
                    ? `AI 标注 ${boxCount} 处${showBoxes ? '' : '（已隐藏）'}`
                    : ''}
                </span>
                <span>仅供教学</span>
              </div>
            </div>

            {/* 影像选择：示例缩略图 + 上传 */}
            <div className='flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 p-2.5'>
              {samples.map((s) => (
                <Thumb
                  key={s.id}
                  active={s.id === sampleId}
                  url={s.imageUrl}
                  title={shortName(s.name)}
                  subtitle={s.modality}
                  onClick={() => pickSample(s.id)}
                />
              ))}
              {file && previewUrl && (
                <Thumb
                  active={!sample}
                  url={previewUrl}
                  title={file.name}
                  subtitle='本地上传'
                  onClick={() => {
                    if (sample) startNew()
                    setPickedSampleId(null)
                  }}
                />
              )}
              <button
                type='button'
                onClick={() => fileRef.current?.click()}
                className='flex h-[72px] w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/25 text-xs text-zinc-300 transition hover:border-white/50 hover:bg-white/5'
              >
                <ImagePlus className='size-5' />
                上传影像
                <span className='text-[10px] text-zinc-500'>
                  PNG / JPG ≤ 8MB
                </span>
              </button>
              <input
                ref={fileRef}
                type='file'
                accept={ACCEPT}
                className='hidden'
                onChange={onUpload}
              />
            </div>
          </Card>

          {/* ===== 判读面板：① 判读意见 → ② AI 结果 → ③ 自评 ===== */}
          <Card className='min-h-0 gap-0 overflow-hidden py-0 lg:flex lg:flex-col'>
            <Section
              icon={PenLine}
              title='我的判读意见'
              className='shrink-0'
              extra={
                <span className='text-xs text-muted-foreground tabular-nums'>
                  {opinion.length}/2000
                </span>
              }
            >
              <Textarea
                id='opinion'
                ref={opinionRef}
                rows={reading ? 2 : 5}
                maxLength={2000}
                placeholder={OPINION_PLACEHOLDER}
                // 出结果后收窄，把空间留给结果区
                className={cn(
                  'resize-none text-sm leading-relaxed transition-[min-height]',
                  reading ? 'min-h-16' : 'min-h-28'
                )}
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                // Enter 发起判读，Shift+Enter 换行；输入法选词时的回车不触发
                onKeyDown={(e) => {
                  if (
                    e.key !== 'Enter' ||
                    e.shiftKey ||
                    e.nativeEvent.isComposing
                  )
                    return
                  e.preventDefault()
                  if (canAnalyze) analyze()
                }}
              />
              <Button
                size='lg'
                className='w-full'
                disabled={!canAnalyze}
                onClick={analyze}
              >
                {create.isPending ? (
                  <LoaderCircle className='animate-spin' />
                ) : (
                  <Sparkles />
                )}
                {create.isPending
                  ? 'AI 判读中…'
                  : reading
                    ? '重新判读'
                    : '开始 AI 判读'}
              </Button>
              <p className='text-center text-xs text-muted-foreground'>
                {opinionReady
                  ? 'Enter 提交 · Shift + Enter 换行；判读意见与自评会计入学情统计'
                  : '写下判读意见后才能查看 AI 结果'}
              </p>
            </Section>

            <div className='min-h-0 flex-1 overflow-y-auto border-t'>
              <Section
                icon={ScanSearch}
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
                    <span className='text-xs text-muted-foreground tabular-nums'>
                      耗时 {(reading.result.elapsedMs / 1000).toFixed(1)} 秒
                    </span>
                  ))
                }
              >
                {create.isPending ? (
                  <ResultLoading />
                ) : !result ? (
                  <ResultEmpty />
                ) : (
                  <ResultView result={result} />
                )}
              </Section>
            </div>

            {reading && result && (
              <Section
                icon={CircleCheck}
                title='对照自评：我的判读与 AI 结论'
                className='shrink-0 border-t bg-muted/30'
              >
                <div className='grid grid-cols-3 gap-2'>
                  {agreements.map((a) => {
                    const st = agreementStyle[a]
                    const on = reading.agreement === a
                    return (
                      <button
                        key={a}
                        type='button'
                        aria-pressed={on}
                        disabled={agree.isPending}
                        onClick={() => setAgreement(a)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border bg-background py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-60',
                          on && st.active
                        )}
                      >
                        <st.icon className={cn('size-5', !on && st.text)} />
                        {a}
                      </button>
                    )
                  })}
                </div>
                {reading.agreement && (
                  <Completed
                    agreement={reading.agreement}
                    nextName={nextSample ? shortName(nextSample.name) : null}
                    onNext={goNext}
                    onRetry={retry}
                  />
                )}
              </Section>
            )}

            <p className='flex shrink-0 items-center gap-1.5 border-t px-4 py-2 text-[11px] text-muted-foreground'>
              <ShieldAlert className='size-3.5 shrink-0' />
              {engineModel
                ? 'AI 结果可能有误，仅供教学参考，不可用于临床诊断。'
                : '当前未启用 AI 模型，判读结果为演示数据，不可用于临床诊断。'}
            </p>
          </Card>
        </div>
      </Main>

      <HistorySheet open={showHistory} onOpenChange={setShowHistory} />
    </>
  )
}

/* ===================== 标题栏 ===================== */

const STEPS = ['独立判读', 'AI 判读', '对照自评']

function Stepper({ step, done }: { step: number; done: boolean }) {
  return (
    <ol className='hidden items-center gap-2 text-sm md:flex'>
      {STEPS.map((label, i) => {
        const n = i + 1
        const finished = n < step || done
        const current = n === step && !done
        return (
          <li key={label} className='flex items-center gap-2'>
            {i > 0 && (
              <span
                className={cn(
                  'h-px w-8 bg-border',
                  (finished || current) && 'bg-primary'
                )}
              />
            )}
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                finished && 'border-primary bg-primary text-primary-foreground',
                current && 'border-primary text-primary ring-4 ring-primary/15'
              )}
            >
              {finished ? <CircleCheck className='size-3.5' /> : n}
            </span>
            <span
              className={cn(
                'text-muted-foreground',
                (finished || current) && 'font-medium text-foreground'
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function EngineStatus({ model }: { model: string | null }) {
  return (
    <span
      className={cn(
        'flex h-9 items-center gap-2 rounded-md border px-3 text-xs',
        model
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/40 bg-amber-500/5'
      )}
      title={model ? '已连接 AI 判读模型' : '未启用 AI 模型，结果为演示数据'}
    >
      <span className='relative flex size-2'>
        {model && (
          <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60' />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            model ? 'bg-emerald-500' : 'bg-amber-500'
          )}
        />
      </span>
      <span className='text-muted-foreground'>
        {model ? '模型已连接' : '演示模式'}
      </span>
      {model && <span className='font-medium'>{model}</span>}
    </span>
  )
}

/* ===================== 查看器 ===================== */

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4',
        active && 'bg-white/15 text-white'
      )}
    >
      {children}
    </button>
  )
}

function Thumb({
  active,
  url,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  url: string | null
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'group relative h-[72px] w-36 shrink-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900 text-start transition',
        active
          ? 'border-primary ring-2 ring-primary'
          : 'opacity-70 hover:opacity-100'
      )}
    >
      {url && (
        <img
          src={url}
          alt=''
          className='absolute inset-0 size-full object-cover transition-transform group-hover:scale-105'
        />
      )}
      <span className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pt-4 pb-1.5'>
        <span className='block truncate text-xs font-medium text-white'>
          {title}
        </span>
        <span className='block truncate text-[10px] text-zinc-300'>
          {subtitle}
        </span>
      </span>
    </button>
  )
}

/* ===================== 判读面板 ===================== */

/** 「胸部 CT · 肺结节」→「肺结节」 */
function shortName(name: string) {
  return name.split(' · ')[1] ?? name
}

/** 自评后：确认已保存，并给出下一步 */
function Completed({
  agreement,
  nextName,
  onNext,
  onRetry,
}: {
  agreement: Agreement
  nextName: string | null
  onNext: () => void
  onRetry: () => void
}) {
  const matched = agreement === '一致'
  return (
    <div className='animate-in space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 duration-300 fade-in-0 slide-in-from-bottom-1'>
      <div className='flex items-start gap-2 text-sm'>
        <PartyPopper className='mt-0.5 size-4 shrink-0 text-emerald-600' />
        <div className='space-y-0.5'>
          <p className='font-medium'>
            本次判读已完成并保存
            <span className='ms-1 font-normal text-muted-foreground'>
              （可在「判读记录」中回看）
            </span>
          </p>
          <p className='text-xs text-muted-foreground'>
            {matched
              ? '你的判读与 AI 结论一致，继续挑战下一张影像吧。'
              : '建议对照影像上的 AI 标注重新观察，修改判读意见后再判读一次。'}
          </p>
        </div>
      </div>
      <div className='flex gap-2'>
        {!matched && (
          <Button variant='outline' onClick={onRetry}>
            <RotateCcw />
            修改后重判
          </Button>
        )}
        <Button className='flex-1' onClick={onNext}>
          {nextName ? `下一张：${nextName}` : '上传新影像'}
          <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  extra,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  extra?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('space-y-3 p-4', className)}>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <Icon className='size-4 text-primary' />
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function ResultEmpty() {
  const tips = [
    { icon: PenLine, text: '独立观察影像，写下所见与初步诊断' },
    { icon: Sparkles, text: '点击「开始 AI 判读」，查看 AI 标注与提示意见' },
    { icon: CircleCheck, text: '对照两者，自评与 AI 结论的一致程度' },
  ]
  return (
    <div className='flex flex-col items-center gap-4 py-6 text-center'>
      <span className='flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
        <ScanSearch className='size-7' />
      </span>
      <div>
        <p className='font-medium'>等待判读</p>
        <p className='text-sm text-muted-foreground'>
          AI 结果会在提交判读意见后显示
        </p>
      </div>
      <ol className='w-full space-y-2 text-start'>
        {tips.map((t, i) => (
          <li
            key={t.text}
            className='flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm'
          >
            <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-primary shadow-sm'>
              {i + 1}
            </span>
            <span className='text-muted-foreground'>{t.text}</span>
            <t.icon className='ms-auto size-4 shrink-0 text-muted-foreground/60' />
          </li>
        ))}
      </ol>
    </div>
  )
}

function ResultLoading() {
  return (
    <div className='space-y-4'>
      <p className='flex items-center gap-2 text-sm text-muted-foreground'>
        <LoaderCircle className='size-4 animate-spin text-primary' />
        AI 正在分析影像，通常需要 5～30 秒…
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className='space-y-2'>
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-1.5 w-full' />
        </div>
      ))}
      <Skeleton className='h-20 w-full' />
    </div>
  )
}

function confidenceTone(c: number) {
  return c >= 0.85
    ? { bar: 'bg-rose-500', pill: 'bg-rose-500/10 text-rose-600' }
    : c >= 0.7
      ? { bar: 'bg-amber-500', pill: 'bg-amber-500/10 text-amber-600' }
      : { bar: 'bg-sky-500', pill: 'bg-sky-500/10 text-sky-600' }
}

function ResultView({ result }: { result: AiResult }) {
  return (
    <div className='space-y-5'>
      <div className='space-y-2'>
        <h3 className='text-xs font-medium tracking-wide text-muted-foreground'>
          异常发现 · {result.findings.length} 处
        </h3>
        {result.findings.length === 0 && (
          <p className='rounded-lg border bg-muted/30 p-3 text-sm'>
            未发现明确异常。
          </p>
        )}
        {result.findings.map((f, i) => {
          const tone = confidenceTone(f.confidence)
          return (
            <div
              key={`${i}-${f.label}`}
              className='space-y-2 rounded-lg border p-3'
            >
              <div className='flex items-start gap-2.5 text-sm'>
                <span className='flex size-5 shrink-0 items-center justify-center rounded bg-rose-500 text-[11px] font-semibold text-white'>
                  {i + 1}
                </span>
                <span className='flex-1 leading-snug'>{f.label}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                    tone.pill
                  )}
                >
                  置信度 {(f.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className='h-1 overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn('h-full rounded-full', tone.bar)}
                  style={{ width: `${f.confidence * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className='space-y-2'>
        <h3 className='text-xs font-medium tracking-wide text-muted-foreground'>
          提示意见
        </h3>
        <p className='rounded-lg border-s-4 border-primary bg-primary/5 p-3 text-sm leading-relaxed'>
          {result.impression}
        </p>
      </div>

      {result.suggestions.length > 0 && (
        <div className='space-y-2'>
          <h3 className='text-xs font-medium tracking-wide text-muted-foreground'>
            学习建议
          </h3>
          <ul className='space-y-1.5 text-sm leading-relaxed'>
            {result.suggestions.map((s) => (
              <li key={s} className='flex gap-2'>
                <Lightbulb className='mt-0.5 size-4 shrink-0 text-amber-500' />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ===================== 判读记录 ===================== */

function HistorySheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-md'>
        <SheetHeader className='border-b'>
          <SheetTitle className='flex items-center gap-2'>
            <History className='size-4' />
            判读记录
          </SheetTitle>
          <SheetDescription>
            {showStudent ? '全部用户' : '我'}的 AI 判读记录，共 {total} 条
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-2 overflow-y-auto p-4'>
          {items.map((r) => {
            const st = r.agreement ? agreementStyle[r.agreement] : null
            return (
              <div key={r.id} className='flex gap-3 rounded-lg border p-2.5'>
                <div className='size-16 shrink-0 overflow-hidden rounded-md bg-black'>
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt=''
                      className='size-full object-cover'
                    />
                  )}
                </div>
                <div className='min-w-0 flex-1 space-y-1'>
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
                      <Badge
                        variant='outline'
                        className='me-1 px-1 py-0 text-[10px]'
                      >
                        演示
                      </Badge>
                    )}
                    {r.result.impression}
                  </p>
                  <p
                    className={cn(
                      'flex items-center gap-1 text-xs',
                      st ? st.text : 'text-muted-foreground'
                    )}
                  >
                    {st && <st.icon className='size-3.5' />}
                    {r.agreement ?? '未自评'}
                  </p>
                </div>
              </div>
            )
          })}
          {records.data && items.length === 0 && (
            <p className='py-16 text-center text-sm text-muted-foreground'>
              还没有判读记录。
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className='flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground'>
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
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ===================== 影像与标注 ===================== */

/** 影像按所在区域等比缩放（尽量撑满），标注框叠加在图像上，单位为图像宽高百分比 */
function FittedImage({
  url,
  label,
  result,
  scanning,
  invert,
}: {
  url: string | null
  label: string
  result: AiResult | null
  scanning: boolean
  invert: boolean
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
        <LesionBox
          key={`${i}-${f.label}`}
          index={i}
          confidence={f.confidence}
          box={f.box}
        />
      )
  )
  const overlay = (
    <>
      {scanning && <ScanOverlay />}
      <div className='pointer-events-none absolute inset-0'>{boxes}</div>
    </>
  )

  return (
    <div
      ref={areaRef}
      // 上下留出四角信息文字的位置
      className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden py-9'
    >
      {url ? (
        <div className={cn('relative', !size && 'invisible')} style={size}>
          <img
            key={url}
            src={url}
            alt={label}
            className={cn(
              'block size-full transition-[filter]',
              invert && 'invert'
            )}
            onLoad={(e) =>
              setNatural({
                url,
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
          />
          {overlay}
        </div>
      ) : (
        <MedicalImagePlaceholder label={label} className='size-full'>
          {overlay}
        </MedicalImagePlaceholder>
      )}
    </div>
  )
}

/** 分析中：网格 + 上下往返的扫描光束 + 四角取景框 + 状态提示 */
function ScanOverlay() {
  return (
    <div
      className='pointer-events-none absolute inset-0 animate-in overflow-hidden duration-300 fade-in-0'
      aria-hidden
    >
      <div className='ai-scan-grid absolute inset-0 bg-cyan-500/5' />
      <div className='ai-scan-beam absolute inset-x-0 h-24 -translate-y-1/2 bg-[linear-gradient(to_bottom,transparent,rgb(34_211_238/0.22)_50%,transparent)]'>
        <div className='absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-cyan-300 shadow-[0_0_12px_2px_rgb(34_211_238/0.8)]' />
      </div>
      <Corners className='inset-3 border-cyan-300/90' size='size-6' />
      <div className='absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-300/40 bg-black/60 px-3 py-1 text-xs text-cyan-100 backdrop-blur-sm'>
        <span className='relative flex size-2'>
          <span className='absolute inline-flex size-full animate-ping rounded-full bg-cyan-300 opacity-75' />
          <span className='relative inline-flex size-2 rounded-full bg-cyan-300' />
        </span>
        AI 正在分析影像…
      </div>
    </div>
  )
}

/** 四角括号：定位到父元素 absolute 区域的四个角 */
function Corners({ className, size }: { className?: string; size: string }) {
  const base = cn('absolute', size)
  return (
    <div className={cn('absolute', className)}>
      <span
        className={cn(
          base,
          'top-0 left-0 rounded-tl-sm border-t-2 border-l-2 border-inherit'
        )}
      />
      <span
        className={cn(
          base,
          'top-0 right-0 rounded-tr-sm border-t-2 border-r-2 border-inherit'
        )}
      />
      <span
        className={cn(
          base,
          'bottom-0 left-0 rounded-bl-sm border-b-2 border-l-2 border-inherit'
        )}
      />
      <span
        className={cn(
          base,
          'right-0 bottom-0 rounded-br-sm border-r-2 border-b-2 border-inherit'
        )}
      />
    </div>
  )
}

/** 病灶标注：半透明填充 + 呼吸光晕 + 四角括号 + 标签（编号 · 置信度，完整描述见右侧列表） */
function LesionBox({
  index,
  confidence,
  box,
}: {
  index: number
  confidence: number
  box: { x: number; y: number; w: number; h: number }
}) {
  // 靠近顶部时标签放到框下方，避免被裁掉
  const labelBelow = box.y < 8
  return (
    <div
      className='ai-box absolute'
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
        animationDelay: `${index * 150}ms`,
      }}
    >
      <div className='ai-box-glow absolute inset-0 rounded-[3px] border border-rose-300/30 bg-rose-500/8' />
      <Corners
        className='-inset-0.5 border-rose-500 drop-shadow-[0_0_3px_rgb(244_63_94/0.9)]'
        size='size-4'
      />
      <span
        className={cn(
          'absolute -left-0.5 flex items-center gap-1 rounded-sm bg-rose-500/90 py-0.5 ps-0.5 pe-1.5 text-[10px] leading-none whitespace-nowrap text-white shadow-md backdrop-blur-sm',
          labelBelow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
        )}
      >
        <span className='flex size-3.5 shrink-0 items-center justify-center rounded-[2px] bg-white text-[9px] font-semibold text-rose-600'>
          {index + 1}
        </span>
        <span className='tabular-nums'>{(confidence * 100).toFixed(0)}%</span>
      </span>
    </div>
  )
}
