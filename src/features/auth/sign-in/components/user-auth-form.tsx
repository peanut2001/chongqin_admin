import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { canAccess, roleLabels } from '@/lib/permissions'
import { sleep, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { DEFAULT_PASSWORD, demoAccounts } from '@/features/users/data/users'
import { authenticate } from '@/features/users/data/users-store'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? '请输入邮箱。' : undefined),
  }),
  password: z
    .string()
    .min(1, '请输入密码。')
    .min(7, '密码长度至少为 7 个字符。'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    // mock 登录：用用户列表里的账号校验（停用/未激活的账号不能登录）
    const login = sleep(800).then(() => authenticate(data.email, data.password))

    toast.promise(login, {
      loading: '正在登录...',
      success: (user) => {
        setIsLoading(false)

        auth.setUser({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          role: user.role,
          exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
        })
        auth.setAccessToken('mock-access-token')

        // 跳回原地址；如果新登录的角色无权访问该地址，则回到首页
        const targetPath =
          redirectTo && canAccess(user.role, redirectTo) ? redirectTo : '/'
        navigate({ to: targetPath, replace: true })

        return `欢迎回来，${roleLabels[user.role]} ${user.username}！`
      },
      error: (err: Error) => {
        setIsLoading(false)
        return err.message
      },
    })
  }

  function fillDemo(email: string) {
    form.setValue('email', email, { shouldValidate: true })
    form.setValue('password', DEFAULT_PASSWORD, { shouldValidate: true })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                忘记密码？
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          登录
        </Button>

        <div className='relative my-2'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs'>
            <span className='bg-background px-2 text-muted-foreground'>
              演示账号（密码 {DEFAULT_PASSWORD}）
            </span>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2'>
          {demoAccounts.map((account) => (
            <Button
              key={account.id}
              variant='outline'
              type='button'
              disabled={isLoading}
              onClick={() => fillDemo(account.email)}
            >
              {roleLabels[account.role]}
            </Button>
          ))}
        </div>
      </form>
    </Form>
  )
}
