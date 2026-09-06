import { cn } from '../lib/cn'
import { formatFull } from '../lib/format'

export interface BreakdownRow {
  label: string
  clicks: number
  share: number
}

/**
 * Ranked bars instead of a pie: shares this close together are impossible to
 * compare as angles, and the label has room to be a full domain name.
 */
export function Breakdown({
  rows,
  emptyLabel = 'No data in this range yet.',
  className,
}: {
  rows: BreakdownRow[]
  emptyLabel?: string
  className?: string
}) {
  if (rows.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-text-muted', className)}>{emptyLabel}</p>
  }

  const top = Math.max(...rows.map((row) => row.clicks), 1)

  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 tnum text-text-muted">
              {formatFull(row.clicks)}
              {/* No opacity here: dimming muted text again drops it under AA. */}
              <span className="ml-1.5 text-xs">{row.share}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.max((row.clicks / top) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
