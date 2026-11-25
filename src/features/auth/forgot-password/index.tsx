import { Link } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'

/** 平台账号由管理员开通，暂无邮件服务，忘记密码需联系管理员重置 */
export function ForgotPassword() {
  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4 sm:min-w-sm'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg tracking-tight'>
            <KeyRound className='size-5' />
            忘记密码
          </CardTitle>
          <CardDescription>平台账号由管理员统一开通与管理。</CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 text-sm text-muted-foreground'>
          <p>
            请联系课程管理员或任课教师，由管理员在「用户管理」中为你重置密码。
          </p>
          <p>
            重置后请使用新密码登录，并尽快在「设置 → 账户」中修改为自己的密码。
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild variant='outline' className='w-full'>
            <Link to='/sign-in'>返回登录</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
