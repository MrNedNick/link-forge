import { Badge } from '../../components/badge/badge'
import { Button } from '../../components/button/button'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { EmptyState } from '../../components/empty-state/empty-state'
import { useConfirm } from '../../components/confirm-dialog/confirm-dialog'
import { useToast } from '../../components/toast/toast'
import { api, errorMessage, unwrap } from '../../api/client'
import type { LinkItem } from '../../api/types'
import { CopyButton } from '../../ui/copy-button'
import { Sparkline } from '../../ui/sparkline'
import { formatFull, formatRelative, hostOf, shortenUrl } from '../../lib/format'

function ExpiryBadge({ link }: { link: LinkItem }) {
  if (link.expired) return <Badge tone="danger">Expired</Badge>
  if (!link.expiresAt) return null
  return <Badge tone="warning">Ends {formatRelative(link.expiresAt)}</Badge>
}

export function LinksTable({
  links,
  loading,
  filtered,
  onDeleted,
  onShowQr,
  onShowStats,
  onEdit,
  onClearFilters,
}: {
  links: LinkItem[]
  loading: boolean
  filtered: boolean
  onDeleted: (id: string) => void
  onShowQr: (link: LinkItem) => void
  onShowStats: (link: LinkItem) => void
  onEdit: (link: LinkItem) => void
  onClearFilters: () => void
}) {
  const confirm = useConfirm()
  const toast = useToast()

  const remove = async (link: LinkItem) => {
    const yes = await confirm({
      title: `Delete /${link.code}?`,
      description:
        'The short link stops working immediately and its click history is deleted with it. This cannot be undone.',
      confirmLabel: 'Delete link',
      variant: 'danger',
    })
    if (!yes) return

    try {
      await unwrap(await api.api.links[':id'].$delete({ param: { id: link.id } }))
      onDeleted(link.id)
      toast.success(`/${link.code} deleted.`)
    } catch (cause) {
      toast.error(errorMessage(cause))
    }
  }

  const columns: DataTableColumn<LinkItem>[] = [
    {
      key: 'code',
      header: 'Short link',
      sortable: true,
      sortValue: (link) => link.code,
      cell: (link) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <a
              href={link.shortUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium text-accent hover:underline"
            >
              /{link.code}
            </a>
            {/* Absolutely positioned helpers (sr-only) inside a horizontally
                scrolling table push the whole page sideways, so the label is
                hidden with display instead and the button carries an aria-label. */}
            <CopyButton value={link.shortUrl} label={`Copy the short link for ${link.code}`}>
              <span className="hidden sm:inline">Copy</span>
            </CopyButton>
          </div>
          {link.title && <p className="truncate text-xs text-text-muted">{link.title}</p>}
        </div>
      ),
    },
    {
      key: 'url',
      header: 'Destination',
      sortable: true,
      sortValue: (link) => hostOf(link.url),
      className: 'hidden md:table-cell',
      cell: (link) => (
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={link.url}
          className="block max-w-[22rem] truncate text-text-muted hover:text-text hover:underline"
        >
          {shortenUrl(link.url)}
        </a>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      className: 'hidden lg:table-cell',
      cell: (link) => (
        <div className="flex flex-wrap gap-1">
          {link.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
          <ExpiryBadge link={link} />
        </div>
      ),
    },
    {
      key: 'clicks',
      header: 'Clicks · all time',
      sortable: true,
      sortValue: (link) => link.clicks,
      cell: (link) => (
        <div className="flex items-center justify-end gap-3">
          <Sparkline values={link.sparkline} className="hidden sm:block" />
          <div className="text-right">
            <p className="font-semibold tnum">{formatFull(link.clicks)}</p>
            <p className="text-xs text-text-muted tnum">{formatFull(link.visitors)} unique</p>
          </div>
        </div>
      ),
      className: 'text-right',
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      sortValue: (link) => link.createdAt,
      className: 'hidden xl:table-cell whitespace-nowrap',
      cell: (link) => <span className="text-text-muted">{formatRelative(link.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (link) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onShowStats(link)} aria-label={`Stats for ${link.code}`}>
            Stats
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onShowQr(link)} aria-label={`QR code for ${link.code}`}>
            QR
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(link)} aria-label={`Edit ${link.code}`}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void remove(link)}
            aria-label={`Delete ${link.code}`}
            className="text-text-muted hover:text-danger"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
              <path
                d="M4.5 6h11m-8.5 0V4.75A1.25 1.25 0 0 1 8.25 3.5h3.5A1.25 1.25 0 0 1 13 4.75V6m1.5 0-.6 9.1a1.4 1.4 0 0 1-1.4 1.4H7.5a1.4 1.4 0 0 1-1.4-1.4L5.5 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </div>
      ),
      className: 'text-right',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={links}
      getRowId={(link) => link.id}
      loading={loading}
      skeletonRows={5}
      pageSize={8}
      defaultSort={{ key: 'clicks', direction: 'desc' }}
      emptyState={
        filtered ? (
          <EmptyState
            title="Nothing matches that filter"
            description="Try a different word, or clear the filters to see every link again."
            action={
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No links yet"
            description="Paste a URL in the box above and it becomes a short link with its own click history."
            icon={
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9.5 14.5a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1m-4-4a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        )
      }
    />
  )
}
