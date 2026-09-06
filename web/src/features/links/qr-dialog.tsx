import { Button } from '../../components/button/button'
import { Modal } from '../../components/modal/modal'
import { Skeleton } from '../../components/skeleton/skeleton'
import type { LinkItem } from '../../api/types'
import { useResource } from '../../hooks/use-resource'

/** The QR is an SVG document, not JSON, so it is fetched rather than called over RPC. */
async function fetchQr(id: string | null): Promise<string | null> {
  if (!id) return null
  const response = await fetch(`/api/links/${id}/qr.svg`, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Could not render the QR code.')
  return response.text()
}

export function QrDialog({ link, onClose }: { link: LinkItem | null; onClose: () => void }) {
  const id = link?.id ?? null
  const qr = useResource(() => fetchQr(id), [id])

  const download = () => {
    if (!qr.data || !link) return
    const url = URL.createObjectURL(new Blob([qr.data], { type: 'image/svg+xml' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `link-forge-${link.code}.svg`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={link !== null}
      onClose={onClose}
      size="sm"
      title={link ? `QR code for /${link.code}` : 'QR code'}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={download} disabled={!qr.data}>
            Download SVG
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-56 place-items-center rounded-xl border border-border bg-white p-3">
          {qr.error ? (
            <p className="px-4 text-center text-sm text-danger">{qr.error}</p>
          ) : qr.data ? (
            // The markup comes from this app's own API, rendered by the qrcode library.
            <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr.data }} />
          ) : (
            <Skeleton className="size-44 rounded-lg" />
          )}
        </div>
        <p className="text-center text-sm break-all text-text-muted">{link?.shortUrl}</p>
      </div>
    </Modal>
  )
}
