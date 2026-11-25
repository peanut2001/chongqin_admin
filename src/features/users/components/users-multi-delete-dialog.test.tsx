import { useState } from 'react'
import { createTableMock } from '@/test-utils/tanstack-table'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type BulkResult } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type MutateOpts = { onSuccess?: (r: BulkResult) => void }
let result: BulkResult = { affected: 2, skipped: [] }
const bulkMutate = vi.fn((_input: unknown, opts?: MutateOpts) =>
  opts?.onSuccess?.(result)
)

vi.mock('../api', () => ({
  useBulkUsers: () => ({ mutate: bulkMutate, isPending: false }),
}))

const toastSuccess = vi.fn()
const toastWarning = vi.fn()
vi.mock('sonner', async (orig) => ({
  ...(await orig<typeof import('sonner')>()),
  toast: Object.assign(vi.fn(), {
    success: (m: string) => toastSuccess(m),
    warning: (m: string) => toastWarning(m),
    error: vi.fn(),
  }),
}))

const confirmInput = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.getByRole('textbox', { name: /输入“DELETE”以确认/i })

describe('UsersMultiDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    result = { affected: 2, skipped: [] }
  })

  it('renders the title with the selected count and a disabled delete button', async () => {
    const { table } = createTableMock()
    const screen = await render(
      <UsersMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
    )
    await expect
      .element(
        screen.getByRole('heading', { level: 2, name: /删除 2 个用户/i })
      )
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: /^删除$/ }))
      .toBeDisabled()
  })

  it('enables delete only after typing DELETE', async () => {
    const { table } = createTableMock()
    const screen = await render(
      <UsersMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
    )
    const deleteButton = screen.getByRole('button', { name: /^删除$/ })
    await userEvent.fill(confirmInput(screen), 'wrong-input')
    await expect.element(deleteButton).toBeDisabled()
    await userEvent.fill(confirmInput(screen), 'DELETE')
    await expect.element(deleteButton).toBeEnabled()
  })

  it('resets the confirm input when the dialog is closed and reopened', async () => {
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
    const screen = await render(<Harness />)
    await userEvent.fill(confirmInput(screen), 'DELETE')
    await userEvent.click(screen.getByRole('button', { name: /取消/i }))
    await userEvent.click(screen.getByRole('button', { name: /Reopen/i }))
    await expect.element(confirmInput(screen)).toHaveValue('')
  })

  it('sends the selected ids to the bulk API and resets selection', async () => {
    const { table, resetRowSelection } = createTableMock()
    const onOpenChange = vi.fn()
    const screen = await render(
      <UsersMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
    )
    await userEvent.fill(confirmInput(screen), 'DELETE')
    await userEvent.click(screen.getByRole('button', { name: /^删除$/ }))

    expect(bulkMutate).toHaveBeenCalledWith(
      { action: 'delete', ids: ['row-1', 'row-2'] },
      expect.anything()
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(resetRowSelection).toHaveBeenCalledOnce()
    expect(toastSuccess).toHaveBeenCalledWith('已删除 2 个用户')
  })

  it('reports users skipped by the server (e.g. yourself)', async () => {
    result = { affected: 1, skipped: [{ id: 'row-2', reason: 'self' }] }
    const { table } = createTableMock()
    const screen = await render(
      <UsersMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
    )
    await userEvent.fill(confirmInput(screen), 'DELETE')
    await userEvent.keyboard('{Enter}')

    expect(toastSuccess).toHaveBeenCalledWith('已删除 1 个用户')
    expect(toastWarning).toHaveBeenCalledWith(
      expect.stringContaining('不能操作当前登录的自己')
    )
  })
})
