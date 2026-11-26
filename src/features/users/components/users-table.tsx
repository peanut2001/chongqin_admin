import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { X } from 'lucide-react'
import { useMeta } from '@/lib/api/meta'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { useUsers } from '../api'
import { roles, statuses } from '../data/data'
import { type User, type UsersQuery } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { usersColumns as columns } from './users-columns'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

const EMPTY: User[] = []

/** 关键字输入防抖，避免每敲一个字就请求一次 */
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * 用户表格：分页、筛选、排序全部由后端完成（manual 模式），
 * 筛选与分页状态同步在地址栏，刷新页面可恢复。
 */
export function UsersTable({ search, navigate }: DataTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

  // Synced with URL states (keys/defaults mirror users route search schema)
  const urlState = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'username', searchKey: 'username', type: 'string' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
    ],
  })
  const { columnFilters, pagination, ensurePageInRange } = urlState

  // 翻页、筛选、排序变化时清空勾选，避免批量操作作用到看不见的行
  const onPaginationChange: OnChangeFn<PaginationState> = (u) => {
    setRowSelection({})
    urlState.onPaginationChange(u)
  }
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (u) => {
    setRowSelection({})
    urlState.onColumnFiltersChange(u)
  }
  const onSortingChange: OnChangeFn<SortingState> = (u) => {
    setRowSelection({})
    setSorting(u)
  }

  // 班级筛选只从班级管理的链接进入，这里只展示与清除
  const classId =
    typeof search.classId === 'number' ? search.classId : undefined
  const { data: meta } = useMeta()
  const className = meta?.classes.find((c) => c.id === classId)?.name
  const clearClass = () => {
    setRowSelection({})
    navigate({
      search: (prev) => ({ ...prev, classId: undefined, page: undefined }),
    })
  }

  const filterValue = (id: string) =>
    columnFilters.find((f) => f.id === id)?.value
  const keyword = useDebounced(String(filterValue('username') ?? ''))
  const query: UsersQuery = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status: (filterValue('status') as UsersQuery['status']) ?? [],
    role: (filterValue('role') as UsersQuery['role']) ?? [],
    username: keyword.trim(),
    classId,
    sort: sorting[0]
      ? `${sorting[0].id}.${sorting[0].desc ? 'desc' : 'asc'}`
      : undefined,
  }
  const { data, isLoading, isError } = useUsers(query)

  const facets = data?.facets
  const facetMaps = useMemo(
    () => ({
      status: new Map(Object.entries(facets?.status ?? {})),
      role: new Map(Object.entries(facets?.role ?? {})),
    }),
    [facets]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? EMPTY,
    columns,
    getRowId: (row) => row.id,
    rowCount: data?.total ?? 0,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    enableRowSelection: true,
    onPaginationChange,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    // 筛选弹窗里的数量来自后端分面统计
    getFacetedUniqueValues: (_table, columnId) => () =>
      facetMaps[columnId as keyof typeof facetMaps] ?? new Map(),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (data) ensurePageInRange(pageCount)
  }, [data, pageCount, ensurePageInRange])

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16', // Add margin bottom to the table on mobile when the toolbar is visible
        'flex flex-1 flex-col gap-4'
      )}
    >
      {classId !== undefined && (
        <div>
          <Badge variant='secondary' className='gap-1 font-normal'>
            班级：{meta ? (className ?? '已删除的班级') : '…'}
            <button
              type='button'
              aria-label='清除班级筛选'
              className='rounded-sm opacity-70 hover:opacity-100'
              onClick={clearClass}
            >
              <X className='size-3' />
            </button>
          </Badge>
        </div>
      )}
      <DataTableToolbar
        table={table}
        searchPlaceholder='搜索用户名 / 姓名 / 邮箱…'
        searchKey='username'
        filters={[
          {
            columnId: 'status',
            title: '状态',
            options: statuses.map((status) => ({ ...status })),
          },
          {
            columnId: 'role',
            title: '角色',
            options: roles.map((role) => ({ ...role })),
          },
        ]}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center text-muted-foreground'
                >
                  {isLoading
                    ? '加载中…'
                    : isError
                      ? '加载失败，请刷新重试。'
                      : '暂无结果。'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DataTableBulkActions table={table} />
    </div>
  )
}
