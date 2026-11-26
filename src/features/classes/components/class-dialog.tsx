import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorTitle, apiFieldErrors } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type SchoolClassRow, useCreateClass, useUpdateClass } from '../api'

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '请输入班级名称。')
    .max(50, '班级名称不超过 50 个字符。'),
  // 输入框是字符串，留空表示不填
  cohortYear: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d{4}$/.test(v) && +v >= 2000 && +v <= 2100),
      '请输入 2000–2100 之间的年份，或留空。'
    ),
})
type ClassForm = z.infer<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 传入时为编辑，否则为新建 */
  current?: SchoolClassRow
}

export function ClassDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const create = useCreateClass()
  const update = useUpdateClass()
  const pending = create.isPending || update.isPending

  const form = useForm<ClassForm>({
    resolver: zodResolver(formSchema),
    values: {
      name: current?.name ?? '',
      cohortYear: current?.cohortYear ? String(current.cohortYear) : '',
    },
  })

  const close = (next: boolean) => {
    if (!next) form.reset()
    onOpenChange(next)
  }

  const onError = (err: unknown) => {
    const fields = apiFieldErrors(err)
    const names = Object.keys(fields).filter((k) => k in formSchema.shape)
    names.forEach((name) =>
      form.setError(name as keyof ClassForm, { message: fields[name] })
    )
    if (names.length === 0) toast.error(apiErrorTitle(err))
  }

  const onSubmit = (values: ClassForm) => {
    const input = {
      name: values.name,
      cohortYear: values.cohortYear ? Number(values.cohortYear) : null,
    }
    const onSuccess = () => {
      toast.success(isEdit ? '班级已更新' : `已创建班级「${input.name}」`)
      close(false)
    }
    if (current) {
      update.mutate({ id: current.id, ...input }, { onSuccess, onError })
    } else {
      create.mutate(input, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑班级' : '新建班级'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '学生在用户管理中分班，授课学期在学期管理中调整。'
              : '新建的班级会自动加入当前学期的授课班级；创建后可在用户管理中把学生分配到该班级。'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='class-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>班级名称</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='例如：2026 级影像硕士 1 班'
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
              name='cohortYear'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>入学年份（选填）</FormLabel>
                  <FormControl>
                    <Input
                      inputMode='numeric'
                      placeholder='例如：2026'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant='outline' onClick={() => close(false)}>
            取消
          </Button>
          <Button type='submit' form='class-form' disabled={pending}>
            {pending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
