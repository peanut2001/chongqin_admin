import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersDeleteDialog } from './users-delete-dialog'

type MutateOpts = { onSuccess?: () => void }
const deleteMutate = vi.fn((_id: string, opts?: MutateOpts) =>
  opts?.onSuccess?.()
)

vi.mock('../api', () => ({
  useDeleteUser: () => ({ mutate: deleteMutate, isPending: false }),
}))

const MOCK_USER: User = {
  id: 'user-delete-test',
  firstName: 'John',
  lastName: 'Doe',
  username: 'john_doe',
  email: 'johndoe@test.com',
  phoneNumber: '+959123456789',
  status: 'active',
  role: 'teacher',
  studentNo: null,
  classId: null,
  className: null,
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-02T00:00:00Z',
}

describe('UsersDeleteDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the dialog with the warning about history and a disabled delete button', async () => {
    const { getByText, getByRole } = await render(
      <UsersDeleteDialog open onOpenChange={vi.fn()} currentRow={MOCK_USER} />
    )
    await expect
      .element(getByRole('heading', { level: 2, name: /删除用户/i }))
      .toBeInTheDocument()
    await expect
      .element(getByText(new RegExp(`确定要删除 ${MOCK_USER.username} 吗？`)))
      .toBeInTheDocument()
    await expect.element(getByText(/建议改为「停用」/)).toBeInTheDocument()
    await expect.element(getByRole('button', { name: /^删除$/ })).toBeDisabled()
  })

  it('keeps the delete button disabled until the username is typed correctly', async () => {
    const { getByRole } = await render(
      <UsersDeleteDialog open onOpenChange={vi.fn()} currentRow={MOCK_USER} />
    )
    const input = getByRole('textbox', { name: /用户名/i })
    const deleteButton = getByRole('button', { name: /^删除$/ })

    await userEvent.fill(input, 'wrong-username')
    await expect.element(deleteButton).toBeDisabled()
    await userEvent.fill(input, MOCK_USER.username)
    await expect.element(deleteButton).toBeEnabled()
  })

  it('closes the dialog when the cancel button is clicked', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersDeleteDialog
        open
        onOpenChange={onOpenChange}
        currentRow={MOCK_USER}
      />
    )
    await userEvent.click(getByRole('button', { name: /取消/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(deleteMutate).not.toHaveBeenCalled()
  })

  it('resets the username input when the dialog is closed and reopened', async () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>
            Reopen
          </button>
          {open ? (
            <UsersDeleteDialog
              open={open}
              onOpenChange={setOpen}
              currentRow={MOCK_USER}
            />
          ) : null}
        </>
      )
    }
    const { getByRole } = await render(<Harness />)
    const input = getByRole('textbox', { name: /用户名/i })
    await userEvent.fill(input, MOCK_USER.username)
    await userEvent.click(getByRole('button', { name: /取消/i }))
    await userEvent.click(getByRole('button', { name: /Reopen/i }))
    await expect.element(input).toHaveValue('')
  })

  it('deletes through the API and closes', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersDeleteDialog
        open
        onOpenChange={onOpenChange}
        currentRow={MOCK_USER}
      />
    )
    await userEvent.fill(
      getByRole('textbox', { name: /用户名/i }),
      MOCK_USER.username
    )
    await userEvent.click(getByRole('button', { name: /^删除$/ }))

    expect(deleteMutate).toHaveBeenCalledWith(MOCK_USER.id, expect.anything())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('deletes when pressing Enter in the username input', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersDeleteDialog
        open
        onOpenChange={onOpenChange}
        currentRow={MOCK_USER}
      />
    )
    await userEvent.fill(
      getByRole('textbox', { name: /用户名/i }),
      MOCK_USER.username
    )
    await userEvent.keyboard('{Enter}')

    expect(deleteMutate).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
