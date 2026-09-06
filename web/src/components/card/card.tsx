import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const INTERACTIVE_CLASSES =
  'w-full text-left transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

export type CardProps =
  | ({ interactive?: false } & HTMLAttributes<HTMLDivElement>)
  | ({ interactive: true } & ButtonHTMLAttributes<HTMLButtonElement>)

/**
 * Container with `CardHeader`/`CardBody`/`CardFooter` slots. Plain by default;
 * pass `interactive` (or use `CardLink`) when the whole card is one target —
 * do not nest another interactive element inside an interactive card.
 */
export function Card({ interactive, className, ...rest }: CardProps) {
  if (interactive) {
    return (
      <button
        type="button"
        className={cn(
          'rounded-lg border border-border bg-surface',
          INTERACTIVE_CLASSES,
          className,
        )}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    )
  }
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface text-left', className)}
      {...(rest as HTMLAttributes<HTMLDivElement>)}
    />
  )
}

export type CardLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>

/** Card rendered as a link — same interactive treatment as `Card interactive`, for navigation. */
export function CardLink({ className, ...rest }: CardLinkProps) {
  return (
    <a
      className={cn(
        'block rounded-lg border border-border bg-surface text-left',
        'transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-b border-border px-4 py-3', className)}
      {...rest}
    />
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-t border-border px-4 py-3', className)}
      {...rest}
    />
  )
}
