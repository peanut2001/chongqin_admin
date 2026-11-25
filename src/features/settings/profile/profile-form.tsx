import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { apiErrorTitle, apiFieldErrors } from '@/lib/api/client'
import { useMe, useUpdateMe } from '@/lib/api/me'
import { roleLabels } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
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

const profileFormSchema = z.object({
  lastName: z.string().max(50, '姓不能超过 50 个字符。'),
  firstName: z.string().min(1, '请输入名。').max(50, '名不能超过 50 个字符。'),
  phoneNumber: z.string().max(30, '手机号不能超过 30 个字符。'),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

/** 只读信息：由管理员维护 */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='grid grid-cols-3 gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='col-span-2'>{value || '—'}</span>
    </div>
  )
}

export function ProfileForm() {
  const { data: me, isLoading } = useMe()
  const updateMe = useUpdateMe()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { lastName: '', firstName: '', phoneNumber: '' },
  })

  // 资料加载完成后填入表单
  useEffect(() => {
    if (me) {
      form.reset({
        lastName: me.lastName,
        firstName: me.firstName,
        phoneNumber: me.phoneNumber,
      })
    }
  }, [me, form])

  const onSubmit = (values: ProfileFormValues) =>
    updateMe.mutate(values, {
      onSuccess: () => toast.success('个人资料已更新'),
      onError: (err) => {
        const fields = apiFieldErrors(err)
        const keys = Object.keys(fields).filter((k) => k in values)
        keys.forEach((k) =>
          form.setError(k as keyof ProfileFormValues, { message: fields[k] })
        )
        if (!keys.length) toast.error(apiErrorTitle(err))
      },
    })

  if (isLoading || !me) {
    return <p className='text-sm text-muted-foreground'>正在加载个人资料…</p>
  }

  return (
    <div className='space-y-8'>
      <div className='space-y-2 rounded-md border p-4'>
        <ReadOnlyRow label='用户名' value={me.username} />
        <ReadOnlyRow label='邮箱' value={me.email} />
        <ReadOnlyRow label='角色' value={roleLabels[me.role]} />
        {me.role === 'student' && (
          <>
            <ReadOnlyRow label='学号' value={me.studentNo ?? ''} />
            <ReadOnlyRow label='班级' value={me.className ?? ''} />
          </>
        )}
        <p className='pt-1 text-xs text-muted-foreground'>
          以上信息由管理员维护，如需修改请联系管理员。
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='lastName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='firstName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name='phoneNumber'
            render={({ field }) => (
              <FormItem>
                <FormLabel>手机号</FormLabel>
                <FormControl>
                  <Input placeholder='+86 138 0000 0000' {...field} />
                </FormControl>
                <FormDescription>仅管理员在用户管理中可见。</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={updateMe.isPending}>
            更新个人资料
          </Button>
        </form>
      </Form>
    </div>
  )
}
