import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const navigate = vi.fn()
const logout = vi.fn()

const MOCK_HREF = 'https://app.test/dashboard?tab=1'

vi.mock('@/lib/api/auth', () => ({
  logout: () => logout(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ href: MOCK_HREF }),
  }
})

function renderDialog() {
  const client = new QueryClient()
  const clear = vi.spyOn(client, 'clear')
  const screen = render(
    <QueryClientProvider client={client}>
      <SignOutDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
  return { screen, clear }
}

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs out via the API, clears cached data and goes to sign-in', async () => {
    logout.mockResolvedValue(undefined)
    const { screen, clear } = renderDialog()

    await userEvent.click(
      (await screen).getByRole('button', { name: /^退出登录$/ })
    )

    await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(clear).toHaveBeenCalled())
    expect(navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: MOCK_HREF },
      replace: true,
    })
  })

  it('still signs out locally when the logout request fails', async () => {
    logout.mockRejectedValue(new Error('network'))
    const { screen } = renderDialog()

    await userEvent.click(
      (await screen).getByRole('button', { name: /^退出登录$/ })
    )

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/sign-in' })
      )
    )
  })
})
