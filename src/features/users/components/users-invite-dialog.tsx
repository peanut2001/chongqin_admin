import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailPlus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { type Role } from '@/lib/permissions'
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
import { roles } from '../data/data'
import { emailExists, useUsersStore } from '../data/users-store'

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

  const addUser = useUsersStore((s) => s.addUser)

  const onSubmit = (values: UserInviteForm) => {
    if (emailExists(values.email)) {
      form.setError('email', { message: '该邮箱已存在。' })
      return
    }

    // 被邀请的用户状态为「已邀请」，管理员激活后才能登录
    const username = values.email.split('@')[0]
    const now = new Date()
    addUser({
      id: crypto.randomUUID(),
      firstName: username,
      lastName: '',
      username,
      email: values.email,
      phoneNumber: '',
      status: 'invited',
      role: values.role as Role,
      createdAt: now,
      updatedAt: now,
    })
    toast.success(`已向 ${values.email} 发送邀请`)

    form.reset()
    onOpenChange(false)
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
            通过发送邮件邀请新用户加入你的团队。分配角色以确定其访问权限。
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
