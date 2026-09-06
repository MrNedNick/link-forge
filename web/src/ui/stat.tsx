import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface StatProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  trend?: number
  className?: string
}

export function Stat({ label, value, hint, trend, className }: StatProps) {
  const direction = trend === undefined ? null : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat'

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-4', className)}>
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tnum">{value}</p>
      {(hint || direction) && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
          {direction && direction !== 'flat' && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium tnum',
                direction === 'up' ? 'text-success' : 'text-danger',
              )}
            >
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                <path
                  d={direction === 'up' ? 'M6 9.5V2.5M6 2.5 2.75 5.75M6 2.5l3.25 3.25' : 'M6 2.5v7M6 9.5 2.75 6.25M6 9.5l3.25-3.25'}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              {Math.abs(trend ?? 0)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  )
}
