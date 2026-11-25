import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  emailEmpty: '请输入邮箱。',
  passwordEmpty: '请输入密码。',
  passwordShort: '密码长度至少为 7 个字符。',
} as const

const navigate = vi.fn()
const setUserMock = vi.fn()
const setAccessTokenMock = vi.fn()

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: {
      setUser: setUserMock,
      setAccessToken: setAccessTokenMock,
    },
  }),
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

vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig()),
  sleep: vi.fn(() => Promise.resolve()),
}))

describe('UserAuthForm', () => {
  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let emailInput: Locator
    let passwordInput: Locator
    let signInButton: Locator
    let forgotPasswordLink: Locator

    beforeEach(async () => {
      vi.clearAllMocks()
      screen = await render(<UserAuthForm />)
      emailInput = screen.getByRole('textbox', { name: /^邮箱$/i })
      passwordInput = screen.getByLabelText(/^密码$/i)
      signInButton = screen.getByRole('button', { name: /^登录$/i })
      forgotPasswordLink = screen.getByText(/^忘记密码？$/i)
    })

    it('renders fields, submit button, and forgot password link', async () => {
      await expect.element(emailInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
      await expect.element(forgotPasswordLink).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect
        .element(screen.getByText(FORM_MESSAGES.emailEmpty))
        .toBeInTheDocument()
      await expect
        .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
        .toBeInTheDocument()
    })

    it('authenticates and navigates to default route on success', async () => {
      await userEvent.fill(emailInput, 'admin@demo.com')
      await userEvent.fill(passwordInput, 'demo1234')

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(setUserMock).toHaveBeenCalledOnce())
      expect(setUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'demo-admin',
          email: 'admin@demo.com',
          role: 'admin',
          exp: expect.any(Number),
        })
      )
      expect(setAccessTokenMock).toHaveBeenCalledOnce()
      expect(setAccessTokenMock).toHaveBeenCalledWith('mock-access-token')

      await vi.waitFor(() =>
        expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
      )
    })

    it('does not sign in with a wrong password', async () => {
      const promiseSpy = vi.spyOn(toast, 'promise')
      await userEvent.fill(emailInput, 'admin@demo.com')
      await userEvent.fill(passwordInput, 'wrong-password')

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(promiseSpy).toHaveBeenCalledOnce())
      await expect(promiseSpy.mock.calls[0][0]).rejects.toThrow(
        '邮箱或密码错误。'
      )
      expect(setUserMock).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
      promiseSpy.mockRestore()
    })

    it('fills the demo account when a role button is clicked', async () => {
      await userEvent.click(screen.getByRole('button', { name: '教师' }))

      await expect.element(emailInput).toHaveValue('teacher@demo.com')
      await expect.element(passwordInput).toHaveValue('demo1234')
    })
  })

  it('navigates to redirectTo when provided', async () => {
    vi.clearAllMocks()

    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/settings' />
    )

    await userEvent.fill(
      getByRole('textbox', { name: /邮箱/i }),
      'student@demo.com'
    )
    await userEvent.fill(getByLabelText('密码'), 'demo1234')

    await userEvent.click(getByRole('button', { name: /^登录$/i }))

    await vi.waitFor(() => expect(setUserMock).toHaveBeenCalledOnce())
    expect(setAccessTokenMock).toHaveBeenCalledOnce()

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/settings',
        replace: true,
      })
    )
  })

  it('falls back to the dashboard when the role cannot access redirectTo', async () => {
    vi.clearAllMocks()

    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/users' />
    )

    await userEvent.fill(
      getByRole('textbox', { name: /邮箱/i }),
      'student@demo.com'
    )
    await userEvent.fill(getByLabelText('密码'), 'demo1234')
    await userEvent.click(getByRole('button', { name: /^登录$/i }))

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    )
  })
})
