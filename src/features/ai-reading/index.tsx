import { useEffect, useRef, useState } from 'react'
import {
  ImagePlus,
  LoaderCircle,
  ScanEye,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
const PAGE_SIZE = 10

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
  const [page, setPage] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)

  const records = useAiReadings(page, PAGE_SIZE)
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
  const totalPages = Math.max(
    1,
    Math.ceil((records.data?.total ?? 0) / PAGE_SIZE)
  )

  return (
    <>
      <DefaultHeader />

      <Main className='space-y-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>AI 图像判读</h1>
          <p className='text-muted-foreground'>
            上传或选择教学影像，先写下自己的判读意见，再与 AI
            辅助判读结果对照学习。
          </p>
        </div>

        <Alert>
          <TriangleAlert />
          <AlertDescription>
            当前尚未接入真实 AI
            模型，判读结果为演示数据，仅用于教学流程展示，不可用于临床诊断。你的判读意见与自评会被保存，用于学情统计。
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 lg:grid-cols-5'>
          {/* ===== 左侧：影像与操作 ===== */}
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle>待判读影像</CardTitle>
              <CardDescription>选择示例影像或上传本地图片</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-wrap gap-2'>
                {samples.map((s) => (
                  <Button
                    key={s.id}
                    size='sm'
                    variant={sampleId === s.id ? 'default' : 'outline'}
                    onClick={() => pickSample(s.id)}
                  >
                    {s.name}
                  </Button>
                ))}
                <Button
                  size='sm'
                  variant={file ? 'default' : 'outline'}
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

              <ImageWithBoxes
                url={sample ? sample.imageUrl : previewUrl}
                label={sample?.name ?? modality}
                result={result}
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>检查类型</Label>
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
                <div className='flex items-end'>
                  <Button
                    className='w-full'
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
              </div>

              <div className='space-y-2'>
                <Label htmlFor='opinion'>我的判读意见</Label>
                <Textarea
                  id='opinion'
                  rows={3}
                  maxLength={2000}
                  placeholder='请先独立描述影像所见与初步诊断，再查看 AI 结果进行对照…'
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                />
                {!opinionReady && (
                  <p className='text-xs text-muted-foreground'>
                    填写判读意见后才能查看 AI 结果。
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ===== 右侧：判读结果 ===== */}
          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Sparkles className='size-5 text-primary' />
                AI 判读结果
                {reading?.isDemo && (
                  <Badge
                    variant='outline'
                    className='border-amber-500 text-amber-600'
                  >
                    演示结果
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {reading
                  ? (reading.disclaimer ??
                    `推理耗时 ${(reading.result.elapsedMs / 1000).toFixed(2)} 秒`)
                  : '填写判读意见后，点击「开始 AI 判读」查看结果'}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              {create.isPending && (
                <div className='flex h-40 items-center justify-center text-muted-foreground'>
                  <LoaderCircle className='me-2 size-5 animate-spin' />
                  分析中…
                </div>
              )}

              {!create.isPending && !result && (
                <div className='flex h-40 items-center justify-center text-sm text-muted-foreground'>
                  暂无结果
                </div>
              )}

              {!create.isPending && reading && result && (
                <>
                  <div className='space-y-3'>
                    <h3 className='text-sm font-semibold'>异常发现</h3>
                    {result.findings.map((f, i) => (
                      <div key={f.label} className='space-y-1'>
                        <div className='flex justify-between text-sm'>
                          <span>
                            <Badge variant='outline' className='me-1'>
                              {i + 1}
                            </Badge>
                            {f.label}
                          </span>
                          <span className='text-muted-foreground'>
                            {(f.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <SimpleProgress
                          value={f.confidence * 100}
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

                  <div>
                    <h3 className='mb-1 text-sm font-semibold'>提示意见</h3>
                    <p className='text-sm text-muted-foreground'>
                      {result.impression}
                    </p>
                  </div>

                  <div>
                    <h3 className='mb-1 text-sm font-semibold'>学习建议</h3>
                    <ul className='list-disc space-y-1 ps-5 text-sm text-muted-foreground'>
                      {result.suggestions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className='rounded-md border bg-muted/40 p-3'>
                    <h3 className='mb-1 text-sm font-semibold'>我的判读意见</h3>
                    <p className='text-sm whitespace-pre-wrap text-muted-foreground'>
                      {reading.opinion}
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <h3 className='text-sm font-semibold'>
                      对照 AI 结果，你的判读与其一致程度？
                    </h3>
                    <div className='flex flex-wrap gap-2'>
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
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>最近判读记录</CardTitle>
            <CardDescription>
              学生判读意见与 AI 结果的一致性（学生自评）
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>影像</TableHead>
                  <TableHead>AI 提示</TableHead>
                  <TableHead>一致性</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(records.data?.items ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='font-medium'>
                      {r.student ?? '—'}
                    </TableCell>
                    <TableCell>{r.sample}</TableCell>
                    <TableCell className='max-w-xs'>
                      <span
                        className='line-clamp-1'
                        title={r.result.impression}
                      >
                        {r.isDemo && (
                          <Badge variant='outline' className='me-1'>
                            演示
                          </Badge>
                        )}
                        {r.result.impression}
                      </span>
                    </TableCell>
                    <TableCell
                      className={
                        r.agreement
                          ? agreementClass[r.agreement]
                          : 'text-muted-foreground'
                      }
                    >
                      {r.agreement ?? '未自评'}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {dateFmt.format(new Date(r.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
                {records.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-20 text-center text-muted-foreground'
                    >
                      还没有判读记录。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className='flex items-center justify-end gap-2 text-sm text-muted-foreground'>
                <span>
                  第 {page} 页，共 {totalPages} 页
                </span>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

function ImageWithBoxes({
  url,
  label,
  result,
}: {
  url: string | null
  label: string
  result: AiResult | null
}) {
  const boxes = result?.findings.map((f, i) => (
    <div
      key={f.label}
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
  ))

  if (url) {
    return (
      <div className='flex justify-center overflow-hidden rounded-md bg-black'>
        <div className='relative'>
          <img src={url} alt={label} className='block max-h-[420px] w-auto' />
          <div className='pointer-events-none absolute inset-0'>{boxes}</div>
        </div>
      </div>
    )
  }

  return (
    <MedicalImagePlaceholder label={label}>{boxes}</MedicalImagePlaceholder>
  )
}
