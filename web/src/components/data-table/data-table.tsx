import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { EmptyState } from '../empty-state/empty-state'
import { Skeleton } from '../skeleton/skeleton'

export type SortDirection = 'asc' | 'desc'

export interface DataTableSort {
  key: string
  direction: SortDirection
}

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  sortable?: boolean
  /** Value compared when sorting — defaults to `String(row[key])` when omitted. */
  sortValue?: (row: T) => string | number
  className?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowId: (row: T) => string | number
  loading?: boolean
  skeletonRows?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyState?: ReactNode
  /** Controlled sort — pass with `onSortChange`, or leave both out for internal state. */
  sort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort | null) => void
  defaultSort?: DataTableSort | null
  pageSize?: number
  /** Controlled page (1-based) — pass with `onPageChange`, or leave out for internal state. */
  page?: number
  onPageChange?: (page: number) => void
  className?: string
}

function cycleDirection(current: SortDirection | undefined): SortDirection | undefined {
  if (current === undefined) return 'asc'
  if (current === 'asc') return 'desc'
  return undefined
}

function defaultSortValue<T>(row: T, key: string): string | number {
  const value = (row as Record<string, unknown>)[key]
  if (typeof value === 'number') return value
  return String(value ?? '')
}

/**
 * Table with sortable columns, client-side pagination, a loading skeleton
 * and an empty state — the four things every data list ends up needing.
 * Sorting and pagination each work uncontrolled or controlled, matched by
 * whether their `on*Change` prop is passed.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  loading = false,
  skeletonRows = 5,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyState,
  sort: controlledSort,
  onSortChange,
  defaultSort = null,
  pageSize = 10,
  page: controlledPage,
  onPageChange,
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(defaultSort)
  const [internalPage, setInternalPage] = useState(1)

  const sort = controlledSort !== undefined ? controlledSort : internalSort
  const page = controlledPage ?? internalPage

  function setSort(next: DataTableSort | null) {
    if (onSortChange) onSortChange(next)
    else setInternalSort(next)
  }

  function setPage(next: number) {
    if (onPageChange) onPageChange(next)
    else setInternalPage(next)
  }

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable) return
    const direction = cycleDirection(sort?.key === column.key ? sort.direction : undefined)
    setSort(direction ? { key: column.key, direction } : null)
    setPage(1)
  }

  const sorted = useMemo(() => {
    if (!sort) return data
    const column = columns.find((c) => c.key === sort.key)
    const getValue = column?.sortValue ?? ((row: T) => defaultSortValue(row, sort.key))
    const copy = [...data]
    copy.sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.direction === 'asc' ? cmp : -cmp
    })
    return copy
  }, [data, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const clampedPage = Math.min(page, pageCount)
  const paged = useMemo(
    () => sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [sorted, clampedPage, pageSize],
  )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised">
              {columns.map((column) => {
                const active = sort?.key === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    // aria-sort belongs on the column header, not on the button
                    // inside it: on a <button> the attribute is simply invalid.
                    aria-sort={
                      column.sortable
                        ? active
                          ? sort!.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                    className={cn('px-4 py-2.5 font-medium text-text-muted', column.className)}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 hover:text-text"
                      >
                        {column.header}
                        <span aria-hidden="true" className="text-[10px] leading-none">
                          {active ? (sort!.direction === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <Skeleton />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyState ?? <EmptyState title={emptyTitle} description={emptyDescription} />}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={getRowId(row)} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3 text-text', column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Page {clampedPage} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(clampedPage - 1)}
              disabled={clampedPage <= 1}
              className="rounded-md border border-border px-2.5 py-1 hover:bg-surface-raised disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(clampedPage + 1)}
              disabled={clampedPage >= pageCount}
              className="rounded-md border border-border px-2.5 py-1 hover:bg-surface-raised disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
