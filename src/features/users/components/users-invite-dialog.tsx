import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailPlus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorTitle, apiFieldErrors } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { useInviteUser } from '../api'
import { roles } from '../data/data'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? '请输入要邀请的邮箱。' : undefined),
  }),
  role: z.string().min(1, '角色为必填项。'),
  desc: z.string().optional(),
})

type UserInviteForm = z.infer<typeof formSchema>

type UserInviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersInviteDialog({
  open,
  onOpenChange,
}: UserInviteDialogProps) {
  const form = useForm<UserInviteForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', role: '', desc: '' },
  })

  const invite = useInviteUser()

  const onSubmit = (values: UserInviteForm) => {
    // 受邀用户状态为「已邀请」；暂无邮件服务，需管理员在「编辑」中设置密码后才能登录
    invite.mutate(
      { email: values.email, role: values.role },
      {
        onSuccess: () => {
          toast.success(
            `已创建受邀账号 ${values.email}，请在编辑中为其设置初始密码`
          )
          form.reset()
          onOpenChange(false)
        },
        onError: (err) => {
          const fields = apiFieldErrors(err)
          if (fields.email) form.setError('email', { message: fields.email })
          else toast.error(apiErrorTitle(err))
        },
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <MailPlus /> 邀请用户
          </DialogTitle>
          <DialogDescription>
            为新用户预先创建账号并分配角色。平台暂未接入邮件服务，受邀账号需由管理员在「编辑」中设置初始密码后才能登录。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-invite-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='例如：john.doe@gmail.com'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='选择角色'
                    items={roles.map(({ label, value }) => ({
                      label,
                      value,
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='desc'
              render={({ field }) => (
                <FormItem className=''>
                  <FormLabel>描述（可选）</FormLabel>
                  <FormControl>
                    <Textarea
                      className='resize-none'
                      placeholder='为邀请添加一条个人留言（可选）'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>取消</Button>
          </DialogClose>
          <Button type='submit' form='user-invite-form'>
            邀请 <Send />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
