import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { type AuthUser } from '@/stores/auth-store'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  emailEmpty: '请输入邮箱。',
  passwordEmpty: '请输入密码。',
} as const

const navigate = vi.fn()
const loginMock = vi.fn()

vi.mock('@/lib/api/auth', () => ({
  login: (email: string, password: string) => loginMock(email, password),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

const user = (role: AuthUser['role']): AuthUser => ({
  id: `u-${role}`,
  name: `${role} user`,
  email: `${role}@demo.com`,
  username: role,
  role,
  avatarUrl: null,
  studentNo: null,
  className: null,
})

function renderForm(redirectTo?: string) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <UserAuthForm redirectTo={redirectTo} />
    </QueryClientProvider>
  )
}

describe('UserAuthForm', () => {
  let screen: RenderResult
  let emailInput: Locator
  let passwordInput: Locator
  let signInButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    screen = await renderForm()
    emailInput = screen.getByRole('textbox', { name: /^邮箱$/i })
    passwordInput = screen.getByLabelText(/^密码$/i)
    signInButton = screen.getByRole('button', { name: /^登录$/i })
  })

  it('renders fields, submit button, and forgot password link', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(passwordInput).toBeInTheDocument()
    await expect.element(signInButton).toBeInTheDocument()
    await expect.element(screen.getByText(/^忘记密码？$/i)).toBeInTheDocument()
  })

  it('shows validation messages when submitting empty form', async () => {
    await userEvent.click(signInButton)

    await expect
      .element(screen.getByText(FORM_MESSAGES.emailEmpty))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
      .toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('logs in through the API and navigates to the dashboard', async () => {
    loginMock.mockResolvedValue(user('admin'))
    await userEvent.fill(emailInput, 'admin@demo.com')
    await userEvent.fill(passwordInput, 'demo1234')
    await userEvent.click(signInButton)

    await vi.waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith('admin@demo.com', 'demo1234')
    )
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    )
  })

  it('shows the server message and stays on the page when login fails', async () => {
    const promiseSpy = vi.spyOn(toast, 'promise')
    loginMock.mockRejectedValue(new Error('rejected'))
    await userEvent.fill(emailInput, 'admin@demo.com')
    await userEvent.fill(passwordInput, 'wrong')
    await userEvent.click(signInButton)

    await vi.waitFor(() => expect(promiseSpy).toHaveBeenCalledOnce())
    await expect(promiseSpy.mock.calls[0][0]).rejects.toThrow('rejected')
    expect(navigate).not.toHaveBeenCalled()
    promiseSpy.mockRestore()
  })

  it('fills the demo account when a role button is clicked', async () => {
    await userEvent.click(screen.getByRole('button', { name: '教师' }))

    await expect.element(emailInput).toHaveValue('teacher@demo.com')
    await expect.element(passwordInput).toHaveValue('demo1234')
  })
})

describe('UserAuthForm redirect', () => {
  beforeEach(() => vi.clearAllMocks())

  it('navigates to redirectTo when the role can access it', async () => {
    loginMock.mockResolvedValue(user('student'))
    const { getByRole, getByLabelText } = await renderForm('/settings')
    await userEvent.fill(getByRole('textbox', { name: /邮箱/i }), 's@demo.com')
    await userEvent.fill(getByLabelText('密码'), 'demo1234')
    await userEvent.click(getByRole('button', { name: /^登录$/i }))

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/settings', replace: true })
    )
  })

  it('falls back to the dashboard when the role cannot access redirectTo', async () => {
    loginMock.mockResolvedValue(user('student'))
    const { getByRole, getByLabelText } = await renderForm('/users')
    await userEvent.fill(getByRole('textbox', { name: /邮箱/i }), 's@demo.com')
    await userEvent.fill(getByLabelText('密码'), 'demo1234')
    await userEvent.click(getByRole('button', { name: /^登录$/i }))

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    )
  })
})
