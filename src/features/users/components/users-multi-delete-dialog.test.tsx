import { useState } from 'react'
import { createTableMock } from '@/test-utils/tanstack-table'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { useUsersStore } from '../data/users-store'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

const makeUser = (id: string): User => ({
  id,
  firstName: 'Test',
  lastName: id,
  username: id,
  email: `${id}@test.com`,
  phoneNumber: '',
  status: 'active',
  role: 'student',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
})

describe('UsersMultiDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // createTableMock 选中的两行 id 为 row-1、row-2
    useUsersStore.setState({
      users: ['row-1', 'row-2', 'row-3'].map(makeUser),
      passwords: {},
    })
  })

  it('renders the dialog with the correct title, description, input and buttons', async () => {
    const { table } = createTableMock()

    const { getByRole, getByText } = await render(
      <UsersMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
    )

    const title = getByRole('heading', {
      level: 2,
      name: /删除 2 个用户/i,
    })
    const desc = getByText(new RegExp(`确定要删除所选用户吗？`, 'i'))
    const confirmDeleteInput = getByRole('textbox', {
      name: /输入“DELETE”以确认/i,
    })
    const deleteButton = getByRole('button', { name: /删除/i })

    await expect.element(title).toBeInTheDocument()
    await expect.element(desc).toBeInTheDocument()
    await expect.element(confirmDeleteInput).toBeInTheDocument()
    await expect.element(deleteButton).toBeInTheDocument()
    await expect.element(deleteButton).toBeDisabled()
  })

  it('keeps the delete button disabled until the confirm delete input is filled correctly', async () => {
    const { table } = createTableMock()
    const { getByRole } = await render(
      <UsersMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /输入“DELETE”以确认/i,
    })
    const deleteButton = getByRole('button', { name: /删除/i })

    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'wrong-input')
    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(deleteButton).toBeEnabled()
  })

  it('closes the dialog when the cancel button is clicked', async () => {
    const { table } = createTableMock()
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
    )

    const cancelButton = getByRole('button', { name: /取消/i })
    await userEvent.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('resets the confirm delete input when the dialog is closed and reopened', async () => {
    const { table } = createTableMock()

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>
            Reopen
          </button>
          {open ? (
            <UsersMultiDeleteDialog
              open={open}
              onOpenChange={setOpen}
              table={table}
            />
          ) : null}
        </>
      )
    }

    const { getByRole } = await render(<Harness />)

    const confirmDeleteInput = getByRole('textbox', {
      name: /输入“DELETE”以确认/i,
    })
    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(confirmDeleteInput).toHaveValue('DELETE')

    const cancelButton = getByRole('button', { name: /取消/i })
    await userEvent.click(cancelButton)

    const reopenButton = getByRole('button', { name: /Reopen/i })
    await userEvent.click(reopenButton)
    await expect.element(confirmDeleteInput).toHaveValue('')
  })

  it('removes the selected users from the store when deleted successfully', async () => {
    const { table, resetRowSelection } = createTableMock()
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /输入“DELETE”以确认/i,
    })
    const deleteButton = getByRole('button', { name: /删除/i })

    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(deleteButton).toBeEnabled()

    await userEvent.click(deleteButton)

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await vi.waitFor(() => expect(resetRowSelection).toHaveBeenCalledOnce())
    expect(useUsersStore.getState().users.map((u) => u.id)).toEqual(['row-3'])
  })

  it('deletes successfully when press Enter key on the confirm delete input', async () => {
    const { table, resetRowSelection } = createTableMock()
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <UsersMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /输入“DELETE”以确认/i,
    })
    const deleteButton = getByRole('button', { name: /删除/i })

    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(deleteButton).toBeEnabled()

    await userEvent.keyboard('{Enter}')
    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await vi.waitFor(() => expect(resetRowSelection).toHaveBeenCalledOnce())
  })
})
