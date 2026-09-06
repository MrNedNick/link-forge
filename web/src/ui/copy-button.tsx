import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

export interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  children?: React.ReactNode
}

/** Copy with its own confirmation, so a toast is not needed for every little copy. */
export function CopyButton({ value, label = 'Copy short link', className, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard permission can be refused; the text stays selectable regardless.
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
        copied ? 'text-success' : 'text-text-muted hover:bg-surface-raised hover:text-text',
        className,
      )}
    >
      {copied ? (
        <svg viewBox="0 0 20 20" className="size-3.5" fill="none" aria-hidden="true">
          <path d="m4.5 10.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="size-3.5" fill="none" aria-hidden="true">
          <rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 4.5H6A1.5 1.5 0 0 0 4.5 6v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
      {children ?? (copied ? 'Copied' : 'Copy')}
    </button>
  )
}
