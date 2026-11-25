'use client'

import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorTitle, apiFieldErrors, refreshSession } from '@/lib/api/client'
import { useMeta } from '@/lib/api/meta'
import { type Role } from '@/lib/permissions'
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
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import { useCreateUser, useUpdateUser } from '../api'
import { roles } from '../data/data'
import { type User, type UserInput } from '../data/schema'

const formSchema = z
  .object({
    firstName: z.string().min(1, '请输入名。'),
    lastName: z.string().min(1, '请输入姓。'),
    username: z.string().min(1, '用户名为必填项。'),
    phoneNumber: z.string().min(1, '手机号为必填项。'),
    // 仅学生使用
    studentNo: z.string(),
    classId: z.string(),
    email: z.email({
      error: (iss) => (iss.input === '' ? '邮箱为必填项。' : undefined),
    }),
    password: z.string().transform((pwd) => pwd.trim()),
    role: z.string().min(1, '角色为必填项。'),
    confirmPassword: z.string().transform((pwd) => pwd.trim()),
    isEdit: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return data.password.length > 0
    },
    {
      message: '密码为必填项。',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return password.length >= 8
    },
    {
      message: '密码长度至少为 8 个字符。',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return /[a-z]/.test(password)
    },
    {
      message: '密码必须包含至少一个小写字母。',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return /\d/.test(password)
    },
    {
      message: '密码必须包含至少一个数字。',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password, confirmPassword }) => {
      if (isEdit && !password) return true
      return password === confirmPassword
    },
    {
      message: '两次输入的密码不一致。',
      path: ['confirmPassword'],
    }
  )
type UserForm = z.infer<typeof formSchema>

type UserActionDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const isEdit = !!currentRow
  const { auth } = useAuthStore()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const { data: meta } = useMeta()
  // 管理员不能修改自己的角色，避免把自己降级后失去管理权限（后端同样会拒绝）
  const isSelf = isEdit && currentRow.id === auth.user?.id

  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          firstName: currentRow.firstName,
          lastName: currentRow.lastName,
          username: currentRow.username,
          email: currentRow.email,
          role: currentRow.role,
          phoneNumber: currentRow.phoneNumber,
          studentNo: currentRow.studentNo ?? '',
          classId: currentRow.classId ? String(currentRow.classId) : '',
          password: '',
          confirmPassword: '',
          isEdit,
        }
      : {
          firstName: '',
          lastName: '',
          username: '',
          email: '',
          role: '',
          phoneNumber: '',
          studentNo: '',
          classId: '',
          password: '',
          confirmPassword: '',
          isEdit,
        },
  })
  const isStudent =
    useWatch({ control: form.control, name: 'role' }) === 'student'
  const saving = createUser.isPending || updateUser.isPending

  // 后端字段名与表单字段名一致（camelCase），冲突 / 校验错误直接显示在对应输入框
  const showServerErrors = (err: unknown) => {
    const fields = apiFieldErrors(err)
    const names = Object.keys(fields).filter((k) => k in form.getValues())
    names.forEach((name) =>
      form.setError(name as keyof UserForm, { message: fields[name] })
    )
    if (names.length === 0) toast.error(apiErrorTitle(err))
  }

  const onSubmit = (values: UserForm) => {
    const role = values.role as Role
    const input: UserInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      username: values.username,
      email: values.email,
      phoneNumber: values.phoneNumber,
      role,
      studentNo: role === 'student' ? values.studentNo || null : null,
      classId:
        role === 'student' && values.classId ? Number(values.classId) : null,
    }
    if (values.password) input.password = values.password

    const done = (message: string) => {
      toast.success(message)
      form.reset()
      onOpenChange(false)
    }

    if (isEdit) {
      updateUser.mutate(
        { id: currentRow.id, ...input },
        {
          onSuccess: () => {
            // 编辑的是自己时，从服务端刷新右上角 / 侧边栏的登录信息
            if (isSelf) void refreshSession()
            done(`已更新用户 ${input.username}`)
          },
          onError: showServerErrors,
        }
      )
    } else {
      createUser.mutate(input, {
        onSuccess: () => done(`已添加用户 ${input.username}`),
        onError: showServerErrors,
      })
    }
  }

  const isPasswordTouched = !!form.formState.dirtyFields.password

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑用户' : '添加新用户'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '在此更新用户信息。' : '在此创建新用户。'}
            完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='John'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>姓</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Doe'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      用户名
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='john_doe'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>邮箱</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='john.doe@gmail.com'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='phoneNumber'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      手机号
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='+123456789'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>角色</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='选择角色'
                      className='col-span-4'
                      disabled={isSelf}
                      items={roles.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    {isSelf && (
                      <p className='col-span-4 col-start-3 text-xs text-muted-foreground'>
                        不能修改自己的角色。
                      </p>
                    )}
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {isStudent && (
                <>
                  <FormField
                    control={form.control}
                    name='studentNo'
                    render={({ field }) => (
                      <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                        <FormLabel className='col-span-2 text-end'>
                          学号
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='例如：S2025031'
                            className='col-span-4'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className='col-span-4 col-start-3' />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='classId'
                    render={({ field }) => (
                      <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                        <FormLabel className='col-span-2 text-end'>
                          班级
                        </FormLabel>
                        <SelectDropdown
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                          placeholder='选择班级'
                          className='col-span-4'
                          items={(meta?.classes ?? []).map((c) => ({
                            label: c.name,
                            value: String(c.id),
                          }))}
                        />
                        <FormMessage className='col-span-4 col-start-3' />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>密码</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='例如：S3cur3P@ssw0rd'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      确认密码
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        disabled={!isPasswordTouched}
                        placeholder='例如：S3cur3P@ssw0rd'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form' disabled={saving}>
            保存更改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
