import { Button } from '../../components/button/button'
import type { LinkItem } from '../../api/types'
import { CopyButton } from '../../ui/copy-button'
import { shortenUrl } from '../../lib/format'

/**
 * The short link, immediately, in one place. Without this the answer to "what
 * did I just make?" is buried in a table sorted by clicks, where a brand new
 * link with none of them sits last.
 */
export function CreatedLink({
  link,
  onShowQr,
  onDismiss,
}: {
  link: LinkItem
  onShowQr: (link: LinkItem) => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-accent uppercase">Your short link is ready</p>
        <a
          href={link.shortUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate text-lg font-semibold tracking-tight hover:underline"
        >
          {link.shortUrl.replace(/^https?:\/\//, '')}
        </a>
        <p className="mt-0.5 truncate text-sm text-text-muted" title={link.url}>
          goes to {shortenUrl(link.url, 60)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <CopyButton
          value={link.shortUrl}
          label={`Copy the short link for ${link.code}`}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <Button variant="outline" size="sm" onClick={() => onShowQr(link)}>
          QR code
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Dismiss">
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
            <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
