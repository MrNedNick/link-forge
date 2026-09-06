import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClicksChart } from '../ui/clicks-chart'

const DAYS = [
  { date: '2026-03-01', clicks: 12, visitors: 9 },
  { date: '2026-03-02', clicks: 0, visitors: 0 },
  { date: '2026-03-03', clicks: 31, visitors: 24 },
]

describe('ClicksChart', () => {
  it('publishes the same numbers to assistive tech that it draws', () => {
    render(<ClicksChart data={DAYS} />)

    expect(screen.getByRole('img')).toHaveAccessibleName(/43 clicks across 3 days/)

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('Mar 2')
    expect(rows[2]).toHaveTextContent('31')
  })

  it('draws a flat day rather than skipping it', () => {
    const { container } = render(<ClicksChart data={DAYS} />)
    const line = container.querySelector('path[stroke-width="2"]')
    // Three points means the zero day is on the line, not missing from it.
    expect(line?.getAttribute('d')?.split('L')).toHaveLength(3)
  })
})
