import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/badge/badge'
import { Button } from '../../components/button/button'
import { Input } from '../../components/input/input'
import { Skeleton } from '../../components/skeleton/skeleton'
import { api, unwrap } from '../../api/client'
import type { LinkItem, SortDir, SortKey } from '../../api/types'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { useResource } from '../../hooks/use-resource'
import type { SessionUser } from '../../hooks/use-session'
import { formatFull } from '../../lib/format'
import { Breakdown } from '../../ui/breakdown'
import { ClicksChart } from '../../ui/clicks-chart'
import { Container, PageShell } from '../../ui/page-shell'
import { Stat } from '../../ui/stat'
import { CreatedLink } from '../links/created-link'
import { EditLinkDialog } from '../links/edit-link-dialog'
import { CreateLinkForm } from '../links/create-link-form'
import { LinksTable } from '../links/links-table'
import { LinkStatsDialog } from '../links/link-stats-dialog'
import { QrDialog } from '../links/qr-dialog'
import { RecentActivity } from './recent-activity'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center">
      <p className="font-medium text-danger">{message}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
        The dashboard could not load its data. If the API is restarting, give it a second and try again.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function Dashboard({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  // Signing in from the bottom of a long landing page would otherwise drop the
  // user into the middle of the dashboard.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const [days, setDays] = useState(30)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [created, setCreated] = useState<{ link: LinkItem; reused: boolean } | null>(null)
  const [qrLink, setQrLink] = useState<LinkItem | null>(null)
  const [statsLink, setStatsLink] = useState<LinkItem | null>(null)
  const [editLink, setEditLink] = useState<LinkItem | null>(null)

  const query = useDebouncedValue(search.trim(), 250)
  const sort: SortKey = 'created'
  const dir: SortDir = 'desc'

  const overview = useResource(
    async () => unwrap(await api.api.stats.overview.$get({ query: { days: String(days) } })),
    [days],
  )

  const links = useResource(
    async () =>
      unwrap(
        await api.api.links.$get({
          query: { query: query || undefined, tag: tag ?? undefined, sort, dir },
        }),
      ),
    [query, tag],
  )

  const items = links.data?.items ?? []
  const knownTags = links.data?.tags ?? []
  const filtered = query.length > 0 || tag !== null

  const refreshAll = () => {
    void overview.reload()
    void links.reload()
  }

  const onCreated = (link: LinkItem, reused: boolean) => {
    links.setData((current) => ({
      ...current,
      // A reused link is already in the list; adding it again would show it twice.
      items: reused ? current.items : [link, ...current.items],
    }))
    setCreated({ link, reused })
    if (!reused) void overview.reload()
  }

  const onSaved = (link: LinkItem) => {
    links.setData((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === link.id ? link : item)),
      tags: [...new Set([...current.tags, ...link.tags])].sort(),
    }))
    setCreated((current) => (current?.link.id === link.id ? { ...current, link } : current))
  }

  const onDeleted = (id: string) => {
    links.setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
    setCreated((current) => (current?.link.id === id ? null : current))
    void overview.reload()
  }

  const totals = overview.data?.totals
  const rangeLabel = useMemo(() => RANGES.find((range) => range.days === days)?.label ?? `${days} days`, [days])

  return (
    <PageShell
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm text-text-muted sm:block">{user.email}</span>
          <Button variant="outline" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      }
    >
      <Container className="space-y-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-text-muted">
              Everything below covers the last {rangeLabel}.
            </p>
          </div>
          <div role="group" aria-label="Date range" className="flex gap-1 rounded-lg bg-surface-raised p-1">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
                className={
                  days === range.days
                    ? 'rounded-md bg-surface px-3 py-1.5 text-sm font-medium shadow-sm'
                    : 'rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text'
                }
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <CreateLinkForm knownTags={knownTags} onCreated={onCreated} />

        {created && (
          <CreatedLink
            link={created.link}
            reused={created.reused}
            onShowQr={setQrLink}
            onDismiss={() => setCreated(null)}
          />
        )}

        {overview.error ? (
          <ErrorPanel message={overview.error} onRetry={refreshAll} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overview.initial || !totals ? (
                RANGES.concat({ days: 0, label: '' }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-xl" />
                ))
              ) : (
                <>
                  <Stat label="Links" value={formatFull(totals.links)} hint="live in this account" />
                  <Stat
                    label={`Clicks · ${rangeLabel}`}
                    value={formatFull(totals.clicks)}
                    trend={totals.trend}
                    hint="vs the previous period"
                  />
                  <Stat label="Unique visitors" value={formatFull(totals.visitors)} hint="by salted fingerprint" />
                  <Stat
                    label="Busiest link"
                    value={overview.data?.topLinks[0] ? `/${overview.data.topLinks[0].code}` : '—'}
                    hint={
                      overview.data?.topLinks[0]
                        ? `${formatFull(overview.data.topLinks[0].clicks)} clicks`
                        : 'no clicks yet'
                    }
                  />
                </>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title="Clicks per day">
                {overview.initial || !overview.data ? (
                  <Skeleton className="h-60 rounded-lg" />
                ) : (
                  <>
                    <ClicksChart data={overview.data.days} />
                    <p className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded bg-accent" aria-hidden="true" /> Clicks
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded bg-text-muted opacity-70" aria-hidden="true" /> Unique visitors
                      </span>
                    </p>
                  </>
                )}
              </Panel>

              <Panel title="Latest clicks">
                {overview.initial || !overview.data ? (
                  <Skeleton lines={6} />
                ) : (
                  <RecentActivity clicks={overview.data.recent} />
                )}
              </Panel>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {(['sources', 'countries', 'devices'] as const).map((key) => (
                <Panel key={key} title={key}>
                  {overview.initial || !overview.data ? (
                    <Skeleton lines={5} />
                  ) : (
                    <Breakdown rows={overview.data[key]} />
                  )}
                </Panel>
              ))}
            </div>
          </>
        )}

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Your links</h2>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, label or URL"
                aria-label="Search links"
                className="sm:w-64"
              />
            </div>
          </div>

          {knownTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTag(null)}
                aria-pressed={tag === null}
                className="rounded-full"
              >
                <Badge tone={tag === null ? 'accent' : 'neutral'}>All</Badge>
              </button>
              {knownTags.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTag(tag === name ? null : name)}
                  aria-pressed={tag === name}
                  className="rounded-full"
                >
                  <Badge tone={tag === name ? 'accent' : 'neutral'}>{name}</Badge>
                </button>
              ))}
            </div>
          )}

          {links.error ? (
            <ErrorPanel message={links.error} onRetry={() => void links.reload()} />
          ) : (
            <LinksTable
              links={items}
              loading={links.initial}
              filtered={filtered}
              onDeleted={onDeleted}
              onShowQr={setQrLink}
              onShowStats={setStatsLink}
              onEdit={setEditLink}
              onClearFilters={() => {
                setSearch('')
                setTag(null)
              }}
            />
          )}
        </section>
      </Container>

      <QrDialog link={qrLink} onClose={() => setQrLink(null)} />
      <EditLinkDialog link={editLink} onClose={() => setEditLink(null)} onSaved={onSaved} />
      <LinkStatsDialog link={statsLink} onClose={() => setStatsLink(null)} />
    </PageShell>
  )
}
