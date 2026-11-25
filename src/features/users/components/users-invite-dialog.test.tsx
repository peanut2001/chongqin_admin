import { useState } from 'react'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { UsersInviteDialog } from './users-invite-dialog'

type MutateOpts = { onSuccess?: () => void; onError?: (e: unknown) => void }
let serverError: unknown = null
const inviteMutate = vi.fn((_input: unknown, opts?: MutateOpts) =>
  serverError ? opts?.onError?.(serverError) : opts?.onSuccess?.()
)

vi.mock('../api', () => ({
  useInviteUser: () => ({ mutate: inviteMutate, isPending: false }),
}))

describe('UsersInviteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serverError = null
  })

  it('renders the title and explains that an admin must set the password', async () => {
    const { getByRole, getByText } = await render(
      <UsersInviteDialog open onOpenChange={vi.fn()} />
    )
    await expect
      .element(getByRole('heading', { level: 2, name: /邀请用户/i }))
      .toBeInTheDocument()
    await expect
      .element(getByText(/设置初始密码后才能登录/))
      .toBeInTheDocument()
  })

  it('closes when Cancel is clicked', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersInviteDialog open onOpenChange={onOpenChange} />
    )
    await userEvent.click(getByRole('button', { name: /取消/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows error messages for an empty form', async () => {
    const { getByRole, getByText } = await render(
      <UsersInviteDialog open onOpenChange={vi.fn()} />
    )
    await userEvent.click(getByRole('button', { name: /邀请/i }))
    await expect.element(getByText(/请输入要邀请的邮箱。/i)).toBeInTheDocument()
    await expect.element(getByText(/角色为必填项。/i)).toBeInTheDocument()
    expect(inviteMutate).not.toHaveBeenCalled()
  })

  it('resets entered values when the dialog is closed and reopened', async () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>
            Reopen
          </button>
          <UsersInviteDialog open={open} onOpenChange={setOpen} />
        </>
      )
    }
    const { getByRole } = await render(<Harness />)
    const emailInput = getByRole('textbox', { name: /邮箱/i })
    await userEvent.fill(emailInput, 'test@example.com')
    await userEvent.click(getByRole('button', { name: /取消/i }))
    await userEvent.click(getByRole('button', { name: /Reopen/i }))
    await expect.element(emailInput).toHaveValue('')
  })

  it('invites through the API and closes', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersInviteDialog open onOpenChange={onOpenChange} />
    )
    await userEvent.fill(
      getByRole('textbox', { name: /邮箱/i }),
      'test@example.com'
    )
    await userEvent.click(getByRole('combobox', { name: /角色/i }))
    await userEvent.click(getByRole('option', { name: '教师' }))
    await userEvent.click(getByRole('button', { name: /邀请/i }))

    expect(inviteMutate).toHaveBeenCalledWith(
      { email: 'test@example.com', role: 'teacher' },
      expect.anything()
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a duplicate email error from the server on the email field', async () => {
    serverError = new AxiosError('conflict', '409', undefined, undefined, {
      status: 409,
      statusText: 'CONFLICT',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { title: '冲突', fields: { email: '该邮箱已被其他用户使用。' } },
    })
    const onOpenChange = vi.fn()
    const { getByRole, getByText } = await render(
      <UsersInviteDialog open onOpenChange={onOpenChange} />
    )
    await userEvent.fill(
      getByRole('textbox', { name: /邮箱/i }),
      'dup@example.com'
    )
    await userEvent.click(getByRole('combobox', { name: /角色/i }))
    await userEvent.click(getByRole('option', { name: '学生' }))
    await userEvent.click(getByRole('button', { name: /邀请/i }))

    await expect
      .element(getByText('该邮箱已被其他用户使用。'))
      .toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
