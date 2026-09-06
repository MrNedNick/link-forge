import { z } from 'zod'

/**
 * Query strings are strings. Validating the shape here and clamping in one place
 * keeps `?days=99999` from turning into a 99999-point chart, while still
 * accepting a number a person might plausibly type instead of rejecting it.
 */
export const rangeQuery = z.object({
  days: z.string().regex(/^\d{1,4}$/, 'Use a whole number of days.').optional(),
})

export const MIN_DAYS = 1
export const MAX_DAYS = 365

export const resolveDays = (raw: string | undefined, fallback = 30) =>
  Math.min(Math.max(Number(raw ?? fallback), MIN_DAYS), MAX_DAYS)
