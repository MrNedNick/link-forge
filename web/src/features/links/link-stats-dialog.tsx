import { Modal } from '../../components/modal/modal'
import { Skeleton } from '../../components/skeleton/skeleton'
import { api, unwrap } from '../../api/client'
import type { LinkItem } from '../../api/types'
import { useResource } from '../../hooks/use-resource'
import { Breakdown } from '../../ui/breakdown'
import { ClicksChart } from '../../ui/clicks-chart'
import { formatFull, shortenUrl } from '../../lib/format'

export function LinkStatsDialog({ link, onClose }: { link: LinkItem | null; onClose: () => void }) {
  const id = link?.id ?? null
  const stats = useResource(async () => {
    if (!id) return null
    return unwrap(await api.api.links[':id'].stats.$get({ param: { id }, query: { days: '30' } }))
  }, [id])

  return (
    <Modal
      open={link !== null}
      onClose={onClose}
      size="lg"
      title={link ? `/${link.code} · last 30 days` : 'Link statistics'}
    >
      {link && (
        <p className="-mt-2 mb-5 truncate text-sm text-text-muted" title={link.url}>
          {shortenUrl(link.url, 70)}
        </p>
      )}

      {stats.error ? (
        <p className="py-8 text-center text-sm text-danger">{stats.error}</p>
      ) : !stats.data ? (
        <Skeleton className="h-60 rounded-xl" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-text-muted uppercase">Clicks, all time</p>
              <p className="mt-1 text-xl font-semibold tnum">{formatFull(stats.data.clicks)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-text-muted uppercase">Unique visitors</p>
              <p className="mt-1 text-xl font-semibold tnum">{formatFull(stats.data.visitors)}</p>
            </div>
          </div>

          <ClicksChart data={stats.data.days} />

          <div className="grid gap-6 sm:grid-cols-3">
            <section>
              <h3 className="mb-3 text-sm font-medium">Sources</h3>
              <Breakdown rows={stats.data.sources} />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-medium">Countries</h3>
              <Breakdown rows={stats.data.countries} />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-medium">Devices</h3>
              <Breakdown rows={stats.data.devices} />
            </section>
          </div>
        </div>
      )}
    </Modal>
  )
}
