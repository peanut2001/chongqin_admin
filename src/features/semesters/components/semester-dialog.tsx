import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorTitle, apiFieldErrors } from '@/lib/api/client'
import { useMeta } from '@/lib/api/meta'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  coveredWeeks,
  type SemesterRow,
  useCreateSemester,
  useUpdateSemester,
} from '../api'

const formSchema = z
  .object({
    name: z.string().trim().min(1, '请输入学期名称。').max(50),
    course: z.string().trim().min(1, '请输入课程名称。').max(100),
    startDate: z.string().min(1, '请选择开始日期。'),
    endDate: z.string().min(1, '请选择结束日期。'),
    // 留空表示按起止日期自动计算
    totalWeeks: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 30),
        '请输入 1–30 之间的整数，或留空自动计算。'
      ),
    classIds: z.array(z.number()),
    setCurrent: z.boolean(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate > d.startDate, {
    message: '结束日期必须晚于开始日期。',
    path: ['endDate'],
  })
type SemesterForm = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 传入时为编辑，否则为新建 */
  current?: SemesterRow
  /** 新建时预填的课程名称（沿用最近一个学期） */
  defaultCourse?: string
}

export function SemesterDialog({
  open,
  onOpenChange,
  current,
  defaultCourse = '',
}: Props) {
  const isEdit = !!current
  const create = useCreateSemester()
  const update = useUpdateSemester()
  const pending = create.isPending || update.isPending
  const classes = useMeta().data?.classes ?? []

  const form = useForm<SemesterForm>({
    resolver: zodResolver(formSchema),
    values: {
      name: current?.name ?? '',
      course: current?.course ?? defaultCourse,
      startDate: current?.startDate ?? '',
      endDate: current?.endDate ?? '',
      totalWeeks: current ? String(current.totalWeeks) : '',
      // 新建时默认全部班级参加
      classIds: (current?.classes ?? classes).map((c) => c.id),
      setCurrent: false,
    },
  })
  const [startDate, endDate] = useWatch({
    control: form.control,
    name: ['startDate', 'endDate'],
  })
  const autoWeeks = coveredWeeks(startDate, endDate)

  const close = (next: boolean) => {
    if (!next) form.reset()
    onOpenChange(next)
  }

  const onError = (err: unknown) => {
    const fields = apiFieldErrors(err)
    const names = Object.keys(fields).filter((k) => k in formSchema.shape)
    names.forEach((name) =>
      form.setError(name as keyof SemesterForm, { message: fields[name] })
    )
    if (names.length === 0) toast.error(apiErrorTitle(err))
  }

  const onSubmit = ({ setCurrent, totalWeeks, ...values }: SemesterForm) => {
    const input = {
      ...values,
      totalWeeks: totalWeeks ? Number(totalWeeks) : null,
    }
    const onSuccess = () => {
      toast.success(isEdit ? '学期已更新' : `已创建学期「${input.name}」`)
      close(false)
    }
    if (current) {
      update.mutate({ id: current.id, ...input }, { onSuccess, onError })
    } else {
      create.mutate({ ...input, setCurrent }, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑学期' : '新建学期'}</DialogTitle>
          <DialogDescription>
            教学周从开始日期所在那天算起，每 7 天为一周。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='semester-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>学期名称</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='例如：2027-2028 学年第一学期'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='course'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>课程名称</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='例如：医学影像诊断学（研究生）'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='startDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开始日期</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='endDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>结束日期</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='totalWeeks'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>教学周数（选填）</FormLabel>
                  <FormControl>
                    <Input
                      inputMode='numeric'
                      placeholder={
                        autoWeeks ? `留空则为 ${autoWeeks} 周` : '留空自动计算'
                      }
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {autoWeeks
                      ? `起止日期共覆盖 ${autoWeeks} 周，教学周数不能超过它。`
                      : '选好起止日期后会自动计算。'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='classIds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>授课班级</FormLabel>
                  {classes.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      还没有班级，可先到班级管理中新建。
                    </p>
                  ) : (
                    <div className='grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2'>
                      {classes.map((c) => (
                        <label
                          key={c.id}
                          className='flex min-w-0 items-center gap-2 text-sm'
                        >
                          <Checkbox
                            checked={field.value.includes(c.id)}
                            onCheckedChange={(v) =>
                              field.onChange(
                                v === true
                                  ? [...field.value, c.id]
                                  : field.value.filter((id) => id !== c.id)
                              )
                            }
                          />
                          <span className='truncate'>{c.name}</span>
                          <span className='shrink-0 text-muted-foreground'>
                            {c.studentCount} 人
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <FormDescription>
                    教学总览与学情统计只统计授课班级的学生。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEdit && (
              <FormField
                control={form.control}
                name='setCurrent'
                render={({ field }) => (
                  <FormItem className='flex items-center gap-2 space-y-0'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      创建后设为当前学期（还没有当前学期时会自动设为当前）
                    </FormLabel>
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        <DialogFooter>
          <Button variant='outline' onClick={() => close(false)}>
            取消
          </Button>
          <Button type='submit' form='semester-form' disabled={pending}>
            {pending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
