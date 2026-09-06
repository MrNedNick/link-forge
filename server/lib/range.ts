import { z } from 'zod'

/**
 * Query strings are strings. Validating the shape here and clamping in one
 * place keeps `?days=99999` from turning into a 99999-point chart.
 */
export const rangeQuery = z.object({
  days: z.string().regex(/^\d{1,3}$/, 'days must be a number').optional(),
})

export const resolveDays = (raw: string | undefined, fallback = 30) =>
  Math.min(Math.max(Number(raw ?? fallback), 1), 365)
