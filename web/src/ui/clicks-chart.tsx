import { useMemo, useState } from 'react'
import { useMeasure } from '../hooks/use-measure'
import { formatDay, formatFull } from '../lib/format'

export interface DayPoint {
  date: string
  clicks: number
  visitors: number
}

const PADDING = { top: 12, right: 8, bottom: 26, left: 38 }
const HEIGHT = 240

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10
  const ticks: number[] = []
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value)
  return ticks
}

/**
 * Clicks and unique visitors over the selected window. Hand-drawn SVG rather
 * than a charting library: two series and a crosshair do not justify 90 kB, and
 * the accessible fallback below is the same numbers as a real table.
 */
export function ClicksChart({ data }: { data: DayPoint[] }) {
  const { ref, width } = useMeasure<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const chart = useMemo(() => {
    const w = Math.max(width, 320)
    const innerW = w - PADDING.left - PADDING.right
    const innerH = HEIGHT - PADDING.top - PADDING.bottom
    const max = Math.max(...data.map((d) => d.clicks), 1)
    const ticks = niceTicks(max)
    const top = ticks.at(-1) ?? max

    const x = (i: number) => PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
    const y = (value: number) => PADDING.top + innerH - (value / top) * innerH

    const line = (key: 'clicks' | 'visitors') =>
      data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

    const area = `${line('clicks')} L${x(data.length - 1).toFixed(1)},${(PADDING.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PADDING.top + innerH).toFixed(1)} Z`

    // Roughly five labels, always including the first and the last day.
    const every = Math.max(1, Math.round(data.length / 5))
    const labels = data
      .map((d, i) => ({ i, date: d.date }))
      .filter(({ i }) => i === data.length - 1 || i % every === 0)
      .filter(({ i }) => i !== data.length - 1 || true)

    return { w, innerW, innerH, ticks, top, x, y, line, area, labels }
  }, [data, width])

  const total = data.reduce((sum, d) => sum + d.clicks, 0)
  const point = active === null ? null : data[active]

  const move = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left - PADDING.left) / chart.innerW
    const index = Math.round(ratio * (data.length - 1))
    setActive(Math.min(data.length - 1, Math.max(0, index)))
  }

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setActive((current) => {
      const next = (current ?? data.length - 1) + (event.key === 'ArrowRight' ? 1 : -1)
      return Math.min(data.length - 1, Math.max(0, next))
    })
  }

  return (
    <div ref={ref} className="relative">
      <svg
        role="img"
        tabIndex={0}
        aria-label={`Clicks per day: ${formatFull(total)} clicks across ${data.length} days. Use the arrow keys to read individual days.`}
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${chart.w} ${HEIGHT}`}
        className="touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-accent"
        onPointerMove={move}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id="clicks-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="[stop-color:var(--color-accent)]" stopOpacity="0.28" />
            <stop offset="100%" className="[stop-color:var(--color-accent)]" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {chart.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={chart.w - PADDING.right}
              y1={chart.y(tick)}
              y2={chart.y(tick)}
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray={tick === 0 ? undefined : '3 4'}
            />
            <text
              x={PADDING.left - 8}
              y={chart.y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-text-muted text-[10px] tnum"
            >
              {formatFull(tick)}
            </text>
          </g>
        ))}

        <path d={chart.area} fill="url(#clicks-fill)" />
        <path d={chart.line('clicks')} className="stroke-accent" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path
          d={chart.line('visitors')}
          className="stroke-text-muted"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {chart.labels.map(({ i, date }) => (
          <text
            key={date}
            x={chart.x(i)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            className="fill-text-muted text-[10px]"
          >
            {formatDay(date)}
          </text>
        ))}

        {active !== null && point && (
          <g>
            <line
              x1={chart.x(active)}
              x2={chart.x(active)}
              y1={PADDING.top}
              y2={PADDING.top + chart.innerH}
              className="stroke-accent"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={chart.x(active)} cy={chart.y(point.clicks)} r="4" className="fill-accent stroke-surface" strokeWidth="2" />
          </g>
        )}
      </svg>

      {active !== null && point && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-card)]"
          style={{ left: `${Math.min(Math.max((chart.x(active) / chart.w) * 100, 14), 86)}%` }}
        >
          <p className="font-medium">{formatDay(point.date)}</p>
          <p className="mt-1 flex items-center justify-between gap-4 tnum">
            <span className="text-text-muted">Clicks</span>
            <span className="font-semibold text-accent">{formatFull(point.clicks)}</span>
          </p>
          <p className="flex items-center justify-between gap-4 tnum">
            <span className="text-text-muted">Visitors</span>
            <span className="font-medium">{formatFull(point.visitors)}</span>
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>Clicks and unique visitors per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Clicks</th>
            <th scope="col">Visitors</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDay(day.date)}</th>
              <td>{day.clicks}</td>
              <td>{day.visitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
