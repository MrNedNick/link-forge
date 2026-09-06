import { Badge } from '../../components/badge/badge'
import type { RecentClick } from '../../api/types'
import { formatRelative } from '../../lib/format'

const DEVICE_LABEL: Record<string, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
  bot: 'Bot',
}

export function RecentActivity({ clicks }: { clicks: RecentClick[] }) {
  if (clicks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-muted">
        Nothing has been clicked yet. Open one of your short links and it shows up here.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {clicks.map((click) => (
        <li key={click.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">/{click.code}</p>
            <p className="truncate text-xs text-text-muted">
              {click.source === 'direct' ? 'Direct' : click.source} · {click.country}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={click.device === 'bot' ? 'neutral' : 'accent'}>
              {DEVICE_LABEL[click.device] ?? click.device}
            </Badge>
            <time className="w-20 text-right text-xs text-text-muted" dateTime={click.createdAt}>
              {formatRelative(click.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  )
}
