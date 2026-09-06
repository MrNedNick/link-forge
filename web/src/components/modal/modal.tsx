import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Footer area — usually a pair of buttons. */
  actions?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  className?: string
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const

/**
 * Dialog built on the native `<dialog>` element with `showModal()`, which
 * hands over the parts that are tedious and easy to get subtly wrong: focus is
 * trapped and restored, Escape closes, the rest of the page becomes inert (so
 * screen readers cannot wander into the background), and the panel renders in
 * the top layer above any stacking context.
 *
 * The only thing left to do by hand is locking background scroll, which the
 * platform still does not cover.
 */
export function Modal({
  open,
  onClose,
  title,
  actions,
  size = 'md',
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()

    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      // `cancel` fires on Escape — let the parent own the state instead of
      // letting the dialog close itself behind React's back.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        'w-full bg-transparent p-0 backdrop:bg-black/50',
        'max-h-[90dvh] max-w-none open:flex open:items-end open:justify-center sm:open:items-center',
        'm-0 h-full',
      )}
    >
      <div
        className={cn(
          'w-full rounded-t-lg bg-surface shadow-overlay sm:rounded-lg',
          'max-h-[90dvh] overflow-y-auto',
          SIZES[size],
          className,
        )}
      >
        {title && (
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text">{title}</h2>
          </header>
        )}
        <div className="px-5 py-4 text-sm text-text">{children}</div>
        {actions && (
          <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
            {actions}
          </footer>
        )}
      </div>
    </dialog>
  )
}
