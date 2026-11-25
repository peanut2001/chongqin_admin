import { useEffect, useRef, useState } from 'react'
import {
  ImagePlus,
  LoaderCircle,
  ScanEye,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
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
  aiModalities,
  aiRecords,
  aiSamples,
  mockResultFor,
  type AiRecord,
  type AiResult,
} from './data/samples'

const agreementClass: Record<AiRecord['agreement'], string> = {
  一致: 'text-emerald-600',
  部分一致: 'text-amber-600',
  不一致: 'text-rose-600',
}

export function AiReading() {
  const [sampleId, setSampleId] = useState<string | null>(aiSamples[0].id)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [modality, setModality] = useState(aiModalities[0])
  const [opinion, setOpinion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | undefined>(undefined)

  const sample = aiSamples.find((s) => s.id === sampleId)

  // 释放上传图片的 object URL
  useEffect(() => {
    return () => {
      if (uploadUrl) URL.revokeObjectURL(uploadUrl)
    }
  }, [uploadUrl])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const reset = () => {
    window.clearTimeout(timerRef.current)
    setLoading(false)
    setResult(null)
  }

  const pickSample = (id: string) => {
    reset()
    setUploadUrl(null)
    setSampleId(id)
    const s = aiSamples.find((x) => x.id === id)
    if (s) setModality(s.modality)
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    setSampleId(null)
    setUploadUrl(URL.createObjectURL(file))
  }

  const analyze = () => {
    const next = sample ? sample.result : mockResultFor(modality)
    setLoading(true)
    setResult(null)
    // 模拟 AI 推理耗时
    timerRef.current = window.setTimeout(
      () => {
        setResult(next)
        setLoading(false)
      },
      Math.min(next.elapsedMs, 1500)
    )
  }

  const hasImage = !!sample || !!uploadUrl

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
            当前为演示版本，判读结果为模拟数据，仅用于教学流程展示，不可用于临床诊断。
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
                {aiSamples.map((s) => (
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
                  variant={uploadUrl ? 'default' : 'outline'}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus />
                  上传图片
                </Button>
                <input
                  ref={fileRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={onUpload}
                />
              </div>

              <ImageWithBoxes
                url={uploadUrl}
                label={sample?.name ?? modality}
                result={result}
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>检查类型</Label>
                  <Select
                    value={modality}
                    onValueChange={setModality}
                    disabled={!!sample}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiModalities.map((m) => (
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
                    disabled={!hasImage || loading}
                    onClick={analyze}
                  >
                    {loading ? (
                      <LoaderCircle className='animate-spin' />
                    ) : (
                      <ScanEye />
                    )}
                    {loading ? '判读中…' : '开始 AI 判读'}
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='opinion'>我的判读意见</Label>
                <Textarea
                  id='opinion'
                  rows={3}
                  placeholder='请先独立描述影像所见与初步诊断，再查看 AI 结果进行对照…'
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ===== 右侧：判读结果 ===== */}
          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Sparkles className='size-5 text-primary' />
                AI 判读结果
              </CardTitle>
              <CardDescription>
                {result
                  ? `推理耗时 ${(result.elapsedMs / 1000).toFixed(2)} 秒`
                  : '点击「开始 AI 判读」查看结果'}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              {loading && (
                <div className='flex h-40 items-center justify-center text-muted-foreground'>
                  <LoaderCircle className='me-2 size-5 animate-spin' />
                  模型分析中…
                </div>
              )}

              {!loading && !result && (
                <div className='flex h-40 items-center justify-center text-sm text-muted-foreground'>
                  暂无结果
                </div>
              )}

              {result && (
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
                      {opinion.trim() || '（未填写）'}
                    </p>
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
              学生判读意见与 AI 结果的一致性对比
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>学生</TableHead>
                  <TableHead>影像</TableHead>
                  <TableHead>AI 提示</TableHead>
                  <TableHead>一致性</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='text-muted-foreground'>
                      {r.id}
                    </TableCell>
                    <TableCell className='font-medium'>{r.student}</TableCell>
                    <TableCell>{r.sample}</TableCell>
                    <TableCell>{r.aiImpression}</TableCell>
                    <TableCell className={agreementClass[r.agreement]}>
                      {r.agreement}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {r.createdAt}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          <img
            src={url}
            alt='上传的影像'
            className='block max-h-[420px] w-auto'
          />
          <div className='pointer-events-none absolute inset-0'>{boxes}</div>
        </div>
      </div>
    )
  }

  return (
    <MedicalImagePlaceholder label={label}>{boxes}</MedicalImagePlaceholder>
  )
}
