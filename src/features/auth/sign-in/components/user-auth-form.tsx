import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { login } from '@/lib/api/auth'
import { apiErrorTitle } from '@/lib/api/client'
import { canAccess, type Role, roleLabels } from '@/lib/permissions'
import { cn } from '@/lib/utils'
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

/**
 * 演示账号（由后端 flask seed accounts 创建）。
 * 只在开发环境显示，正式构建默认隐藏；演示环境可设置 VITE_SHOW_DEMO_ACCOUNTS=true 显示。
 * 注意：这只是界面开关，真正的限制在后端 ALLOW_DEMO_LOGIN（默认关闭时演示账号无法登录）。
 */
const showDemoAccounts =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true'
const DEMO_PASSWORD = 'demo1234'
const demoAccounts: { role: Role; email: string }[] = [
  { role: 'admin', email: 'admin@demo.com' },
  { role: 'teacher', email: 'teacher@demo.com' },
  { role: 'student', email: 'student@demo.com' },
]

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? '请输入邮箱。' : undefined),
  }),
  password: z.string().min(1, '请输入密码。'),
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
  const queryClient = useQueryClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    toast.promise(login(data.email, data.password), {
      loading: '正在登录...',
      success: (user) => {
        setIsLoading(false)
        // 清掉上一位用户的缓存数据
        queryClient.clear()

        // 跳回原地址；如果新登录的角色无权访问该地址，则回到首页
        const targetPath =
          redirectTo && canAccess(user.role, redirectTo) ? redirectTo : '/'
        navigate({ to: targetPath, replace: true })

        return `欢迎回来，${roleLabels[user.role]} ${user.name}！`
      },
      error: (err) => {
        setIsLoading(false)
        return apiErrorTitle(err, '登录失败，请稍后重试。')
      },
    })
  }

  function fillDemo(email: string) {
    form.setValue('email', email, { shouldValidate: true })
    form.setValue('password', DEMO_PASSWORD, { shouldValidate: true })
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

        {showDemoAccounts && (
          <>
            <div className='relative my-2'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs'>
                <span className='bg-background px-2 text-muted-foreground'>
                  演示账号（密码 {DEMO_PASSWORD}）
                </span>
              </div>
            </div>

            <div className='grid grid-cols-3 gap-2'>
              {demoAccounts.map((account) => (
                <Button
                  key={account.email}
                  variant='outline'
                  type='button'
                  disabled={isLoading}
                  onClick={() => fillDemo(account.email)}
                >
                  {roleLabels[account.role]}
                </Button>
              ))}
            </div>
          </>
        )}
      </form>
    </Form>
  )
}
