import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { apiErrorTitle, apiFieldErrors } from '@/lib/api/client'
import { useChangePassword } from '@/lib/api/me'
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
import { PasswordInput } from '@/components/password-input'

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码。'),
    newPassword: z
      .string()
      .min(8, '密码长度至少为 8 个字符。')
      .regex(/[a-z]/, '密码必须包含至少一个小写字母。')
      .regex(/\d/, '密码必须包含至少一个数字。'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: '两次输入的密码不一致。',
    path: ['confirmPassword'],
  })

type PasswordFormValues = z.infer<typeof passwordFormSchema>

export function AccountForm() {
  const changePassword = useChangePassword()
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = ({ currentPassword, newPassword }: PasswordFormValues) =>
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success('密码已修改，其他设备上的登录已失效。')
          form.reset()
        },
        onError: (err) => {
          const fields = apiFieldErrors(err)
          const keys = Object.keys(fields).filter(
            (k) => k === 'currentPassword' || k === 'newPassword'
          )
          keys.forEach((k) =>
            form.setError(k as keyof PasswordFormValues, {
              message: fields[k],
            })
          )
          if (!keys.length) toast.error(apiErrorTitle(err))
        },
      }
    )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='currentPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>当前密码</FormLabel>
              <FormControl>
                <PasswordInput autoComplete='current-password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='newPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>新密码</FormLabel>
              <FormControl>
                <PasswordInput autoComplete='new-password' {...field} />
              </FormControl>
              <FormDescription>
                至少 8 位，需包含小写字母和数字。修改后其他设备上的登录会失效。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>确认新密码</FormLabel>
              <FormControl>
                <PasswordInput autoComplete='new-password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' disabled={changePassword.isPending}>
          修改密码
        </Button>
      </form>
    </Form>
  )
}
