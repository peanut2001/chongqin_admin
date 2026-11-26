import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type UserEvent, userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersActionDialog } from './users-action-dialog'

const VALIDATION_MESSAGES = {
  firstName: '请输入名。',
  lastName: '请输入姓。',
  username: '用户名为必填项。',
  phoneNumber: '手机号为必填项。',
  email: '邮箱为必填项。',
  role: '角色为必填项。',
  password: '密码为必填项。',
  passwordMismatch: '两次输入的密码不一致。',
  passwordLength: '密码长度至少为 8 个字符。',
  passwordNumber: '密码必须包含至少一个数字。',
  passwordLowercase: '密码必须包含至少一个小写字母。',
} as const

const MOCK_USER: User = {
  id: 'alex_uuid',
  firstName: 'Alex',
  lastName: 'Smith',
  username: 'alex_smith',
  email: 'alex@smith.com',
  phoneNumber: '+19999999999',
  status: 'active',
  role: 'admin',
  studentNo: null,
  classId: null,
  className: null,
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-02T00:00:00Z',
}

type MutateOpts = { onSuccess?: () => void; onError?: (e: unknown) => void }
// 默认模拟服务端成功；个别用例改为返回错误
let serverError: unknown = null
const respond = (opts?: MutateOpts) =>
  serverError ? opts?.onError?.(serverError) : opts?.onSuccess?.()
const createMutate = vi.fn((_input: unknown, opts?: MutateOpts) =>
  respond(opts)
)
const updateMutate = vi.fn((_input: unknown, opts?: MutateOpts) =>
  respond(opts)
)

vi.mock('../api', () => ({
  useCreateUser: () => ({ mutate: createMutate, isPending: false }),
  useUpdateUser: () => ({ mutate: updateMutate, isPending: false }),
}))

vi.mock('@/lib/api/meta', () => ({
  useMeta: () => ({
    data: {
      semester: null,
      classes: [
        { id: 1, name: '1 班', studentCount: 3, inCurrentSemester: true },
      ],
    },
  }),
}))

function conflict(fields: Record<string, string>) {
  return new AxiosError('conflict', '409', undefined, undefined, {
    status: 409,
    statusText: 'CONFLICT',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { title: '提交的信息与已有用户冲突。', code: 'conflict', fields },
  })
}

describe('UsersActionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serverError = null
  })

  describe('add user', () => {
    it('renders title and description', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )
      await expect
        .element(getByRole('heading', { level: 2, name: /添加新用户/i }))
        .toBeInTheDocument()
      await expect
        .element(getByText(/在此创建新用户。完成后点击保存。/i))
        .toBeInTheDocument()
    })

    it('shows validation messages when the form is submitted with empty fields', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )
      await userEvent.click(getByRole('button', { name: /保存更改/i }))

      for (const key of [
        'firstName',
        'lastName',
        'username',
        'phoneNumber',
        'email',
        'role',
        'password',
      ] as const) {
        await expect
          .element(getByText(VALIDATION_MESSAGES[key]))
          .toBeInTheDocument()
      }
      expect(createMutate).not.toHaveBeenCalled()
    })

    it('shows password validation messages when password is invalid', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )
      const password = getByRole('textbox', { name: /^密码$/i })
      const confirmPassword = getByRole('textbox', { name: /确认密码/i })
      await userEvent.type(password, 'a')
      await userEvent.type(confirmPassword, 'b')
      await userEvent.click(getByRole('button', { name: /保存更改/i }))
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordMismatch))
        .toBeInTheDocument()

      await userEvent.fill(password, 'short')
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordLength))
        .toBeInTheDocument()
      await userEvent.fill(password, 'ONLYUPPERCASE')
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordLowercase))
        .toBeInTheDocument()
      await userEvent.fill(password, 'onlylowercase')
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordNumber))
        .toBeInTheDocument()
    })

    it('creates the user through the API and closes', async () => {
      const onOpenChange = vi.fn()
      const screen = await render(
        <UsersActionDialog open onOpenChange={onOpenChange} />
      )
      await fillRequiredProfileFields(userEvent, screen, MOCK_USER)
      await fillPasswords(userEvent, screen, 'S3cur3P@ssw0rd', 'S3cur3P@ssw0rd')
      await userEvent.click(screen.getByRole('button', { name: /保存更改/i }))

      await vi.waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
      expect(createMutate.mock.calls[0][0]).toMatchObject({
        firstName: MOCK_USER.firstName,
        lastName: MOCK_USER.lastName,
        username: MOCK_USER.username,
        email: MOCK_USER.email,
        phoneNumber: MOCK_USER.phoneNumber,
        role: 'admin',
        password: 'S3cur3P@ssw0rd',
        studentNo: null,
        classId: null,
      })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('shows server conflicts on the matching field and stays open', async () => {
      serverError = conflict({ email: '该邮箱已被其他用户使用。' })
      const onOpenChange = vi.fn()
      const screen = await render(
        <UsersActionDialog open onOpenChange={onOpenChange} />
      )
      await fillRequiredProfileFields(userEvent, screen, MOCK_USER)
      await fillPasswords(userEvent, screen, 'S3cur3P@ssw0rd', 'S3cur3P@ssw0rd')
      await userEvent.click(screen.getByRole('button', { name: /保存更改/i }))

      await expect
        .element(screen.getByText('该邮箱已被其他用户使用。'))
        .toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('asks for student number and class when the role is student', async () => {
      const screen = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )
      await fillRequiredProfileFields(userEvent, screen, {
        roleOption: '学生',
      })
      await expect.element(screen.getByLabelText(/^学号$/i)).toBeInTheDocument()
      await userEvent.fill(screen.getByLabelText(/^学号$/i), 'S2025099')
      await userEvent.click(screen.getByRole('combobox', { name: /班级/i }))
      await userEvent.click(screen.getByRole('option', { name: '1 班' }))
      await fillPasswords(userEvent, screen, 'abc12345', 'abc12345')
      await userEvent.click(screen.getByRole('button', { name: /保存更改/i }))

      await vi.waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
      expect(createMutate.mock.calls[0][0]).toMatchObject({
        role: 'student',
        studentNo: 'S2025099',
        classId: 1,
      })
    })
  })

  describe('edit user', () => {
    it('renders title and description', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} currentRow={MOCK_USER} />
      )
      await expect
        .element(getByRole('heading', { level: 2, name: /编辑用户/i }))
        .toBeInTheDocument()
      await expect
        .element(getByText(/在此更新用户信息。完成后点击保存。/i))
        .toBeInTheDocument()
    })

    it('submits without password changes', async () => {
      const onOpenChange = vi.fn()
      const screen = await render(
        <UsersActionDialog
          open
          onOpenChange={onOpenChange}
          currentRow={MOCK_USER}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /保存更改/i }))

      await vi.waitFor(() => expect(updateMutate).toHaveBeenCalledOnce())
      const payload = updateMutate.mock.calls[0][0] as Record<string, unknown>
      expect(payload).toMatchObject({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
      })
      expect(payload).not.toHaveProperty('password')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('requires confirm password when password is changed', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} currentRow={MOCK_USER} />
      )
      await userEvent.fill(
        getByRole('textbox', { name: /^密码$/i }),
        'S3cur3P@ssw0rd'
      )
      await userEvent.click(getByRole('button', { name: /保存更改/i }))
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordMismatch))
        .toBeInTheDocument()
      expect(updateMutate).not.toHaveBeenCalled()
    })

    it('sends the new password when it is changed', async () => {
      const screen = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} currentRow={MOCK_USER} />
      )
      await userEvent.fill(screen.getByLabelText(/^名$/i), 'John')
      await fillPasswords(userEvent, screen, 'S3cur3P@ssw0rd', 'S3cur3P@ssw0rd')
      await userEvent.click(screen.getByRole('button', { name: /保存更改/i }))

      await vi.waitFor(() => expect(updateMutate).toHaveBeenCalledOnce())
      expect(updateMutate.mock.calls[0][0]).toMatchObject({
        id: MOCK_USER.id,
        firstName: 'John',
        password: 'S3cur3P@ssw0rd',
      })
    })
  })
})

async function fillRequiredProfileFields(
  user: UserEvent,
  screen: RenderResult,
  overrides?: {
    firstName?: string
    lastName?: string
    username?: string
    email?: string
    roleOption?: string | RegExp
    phoneNumber?: string
  }
) {
  const entries = [
    [/^名$/i, overrides?.firstName ?? 'John'],
    [/^姓$/i, overrides?.lastName ?? 'Doe'],
    [/^用户名$/i, overrides?.username ?? 'john_doe'],
    [/^邮箱$/i, overrides?.email ?? 'a@b.co'],
    [/^手机号$/i, overrides?.phoneNumber ?? '+19999999999'],
  ] as const

  for (const [label, value] of entries) {
    const el = screen.getByLabelText(label)
    await expect.element(el).toBeInTheDocument()
    await user.fill(el, value)
  }

  await user.click(screen.getByRole('combobox', { name: /角色/i }))
  await user.click(
    screen.getByRole('option', {
      name: overrides?.roleOption ?? '管理员',
      exact: true,
    })
  )
}

async function fillPasswords(
  user: UserEvent,
  screen: RenderResult,
  a: string,
  b: string
) {
  await user.fill(screen.getByLabelText(/^密码$/i), a)
  await user.fill(screen.getByLabelText(/^确认密码$/i), b)
}
