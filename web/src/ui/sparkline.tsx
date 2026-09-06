export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
}

/**
 * Row-sized trend line. Decorative by design: the number beside it in the table
 * is the accessible version of the same fact.
 */
export function Sparkline({ values, width = 88, height = 24, className }: SparklineProps) {
  if (values.length < 2) {
    return <div className={className} style={{ width, height }} aria-hidden="true" />
  }

  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const y = (value: number) => height - 2 - (value / max) * (height - 4)
  const points = values.map((value, i) => `${i * step},${y(value)}`)
  const area = `M0,${height} L${points.join(' L')} L${width},${height} Z`

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} className="fill-accent/12" />
      <polyline
        points={points.join(' ')}
        className="stroke-accent"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
