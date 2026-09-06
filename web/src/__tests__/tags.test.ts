import { describe, expect, it } from 'vitest'
import { MAX_TAGS, expiryFromDays, formatTags, parseTags } from '../lib/tags'

describe('parseTags', () => {
  it('splits on commas and spaces, lowercases and drops blanks', () => {
    expect(parseTags(' Launch,  DOCS   spring , ')).toEqual(['launch', 'docs', 'spring'])
  })

  it('collapses duplicates that differ only by case', () => {
    expect(parseTags('launch, Launch, LAUNCH')).toEqual(['launch'])
  })

  it('stops at the limit the server enforces', () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join(',')
    expect(parseTags(many)).toHaveLength(MAX_TAGS)
  })

  it('truncates a tag rather than sending one the API will reject', () => {
    expect(parseTags('x'.repeat(40))[0]).toHaveLength(24)
  })

  it('round-trips through the input format', () => {
    expect(parseTags(formatTags(['launch', 'docs']))).toEqual(['launch', 'docs'])
  })

  it('returns nothing for empty input', () => {
    expect(parseTags('   ,,  ')).toEqual([])
  })
})

describe('expiryFromDays', () => {
  it('gives null for "never" and a future ISO timestamp otherwise', () => {
    expect(expiryFromDays('')).toBeNull()
    const seven = expiryFromDays('7')
    expect(seven).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(new Date(seven!).getTime()).toBeGreaterThan(Date.now())
  })
})
