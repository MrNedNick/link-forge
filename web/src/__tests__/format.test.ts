import { describe, expect, it } from 'vitest'
import { formatCount, formatDay, hostOf, shortenUrl } from '../lib/format'

describe('formatCount', () => {
  it('spells out small numbers and compacts big ones', () => {
    expect(formatCount(42)).toBe('42')
    expect(formatCount(9_999)).toBe('9,999')
    expect(formatCount(24_500)).toBe('24.5K')
  })
})

describe('shortenUrl', () => {
  it('drops the scheme and keeps both ends of a long address', () => {
    expect(shortenUrl('https://example.com/pricing')).toBe('example.com/pricing')

    const long = shortenUrl('https://example.com/a/very/long/path/that/keeps/going/forever/and/ever')
    expect(long.length).toBeLessThanOrEqual(48)
    expect(long.startsWith('example.com/a/very')).toBe(true)
    expect(long).toContain('…')
    expect(long.endsWith('and/ever')).toBe(true)
  })
})

describe('hostOf', () => {
  it('reduces a URL to a bare host', () => {
    expect(hostOf('https://www.example.com/deep/link?x=1')).toBe('example.com')
    expect(hostOf('not a url')).toBe('not a url')
  })
})

describe('formatDay', () => {
  it('reads a date key as UTC, so a day never shifts by timezone', () => {
    expect(formatDay('2026-01-01')).toBe('Jan 1')
  })
})
