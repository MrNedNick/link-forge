export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 24

/**
 * One parser for both the create and the edit form: split on commas or spaces,
 * lowercase, drop blanks and duplicates, and stop at the server's limit so the
 * form never sends something the API will reject.
 */
export function parseTags(value: string): string[] {
  const tags = value
    .split(/[,\s]+/)
    .map((tag) => tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
    .filter(Boolean)
  return [...new Set(tags)].slice(0, MAX_TAGS)
}

export const formatTags = (tags: readonly string[]) => tags.join(', ')

/** Days from now as an ISO timestamp, or null for "never". */
export const expiryFromDays = (days: string): string | null =>
  days ? new Date(Date.now() + Number(days) * 86_400_000).toISOString() : null

export const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '1', label: 'In 24 hours' },
  { value: '7', label: 'In 7 days' },
  { value: '30', label: 'In 30 days' },
  { value: '90', label: 'In 90 days' },
] as const
