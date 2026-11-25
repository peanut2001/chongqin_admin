import { Link } from '@tanstack/react-router'
import { ClipboardList, ScanEye } from 'lucide-react'
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
import { MedicalImagePlaceholder } from '@/components/medical-image-placeholder'
import { difficultyClass, type MedicalCase } from '../data/cases'

type Props = {
  data: MedicalCase | null
  onOpenChange: (open: boolean) => void
}

export function CaseDetailSheet({ data, onOpenChange }: Props) {
  return (
    <Sheet open={!!data} onOpenChange={onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-xl'>
        {data && (
          <>
            <SheetHeader>
              <div className='flex items-center gap-2'>
                <SheetTitle>{data.title}</SheetTitle>
                <Badge
                  variant='outline'
                  className={difficultyClass[data.difficulty]}
                >
                  {data.difficulty}
                </Badge>
              </div>
              <SheetDescription>
                {data.id} · {data.system} · {data.modality} ·{' '}
                {data.patient.gender}，{data.patient.age} 岁 · 更新于{' '}
                {data.updatedAt}
              </SheetDescription>
            </SheetHeader>

            <div className='flex-1 space-y-5 overflow-y-auto px-4 pb-4'>
              <div className='grid grid-cols-3 gap-2'>
                <MedicalImagePlaceholder
                  label={`${data.modality} 主图`}
                  className='col-span-3'
                />
                {[1, 2, 3].map((i) => (
                  <MedicalImagePlaceholder key={i} label={`序列 ${i}`} />
                ))}
              </div>
              <p className='text-xs text-muted-foreground'>
                共 {data.imageCount} 幅影像（演示环境以占位图代替）
              </p>

              <Section title='主诉'>{data.chiefComplaint}</Section>
              <Section title='病史'>{data.history}</Section>
              <Section title='影像 / 镜下表现'>{data.findings}</Section>
              <Section title='诊断'>
                <span className='font-medium text-foreground'>
                  {data.diagnosis}
                </span>
              </Section>

              <Separator />

              <div>
                <h3 className='mb-2 text-sm font-semibold'>教学要点</h3>
                <ol className='list-decimal space-y-1 ps-5 text-sm text-muted-foreground'>
                  {data.keyPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </div>

              <div className='flex flex-wrap gap-1'>
                {data.tags.map((t) => (
                  <Badge key={t} variant='secondary'>
                    {t}
                  </Badge>
                ))}
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
        )}
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className='mb-1 text-sm font-semibold'>{title}</h3>
      <p className='text-sm leading-relaxed text-muted-foreground'>
        {children}
      </p>
    </div>
  )
}
