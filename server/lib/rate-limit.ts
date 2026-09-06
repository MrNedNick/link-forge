/**
 * Fixed-window counter kept in memory. One process, one map: enough for a single
 * instance, and the interface is the part that matters — swapping the store for
 * Redis or a Postgres table is a change in this file only.
 */
export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets. */
  retryAfter: number
}

export type RateLimiter = ReturnType<typeof createRateLimiter>

export function createRateLimiter({
  limit,
  windowMs,
  now = () => Date.now(),
}: {
  limit: number
  windowMs: number
  now?: () => number
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>()

  const sweep = (at: number) => {
    if (buckets.size < 5000) return
    for (const [key, bucket] of buckets) if (bucket.resetAt <= at) buckets.delete(key)
  }

  return {
    limit,
    check(key: string): RateLimitResult {
      const at = now()
      sweep(at)
      const bucket = buckets.get(key)

      if (!bucket || bucket.resetAt <= at) {
        buckets.set(key, { count: 1, resetAt: at + windowMs })
        return { ok: true, limit, remaining: limit - 1, retryAfter: 0 }
      }

      bucket.count += 1
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - at) / 1000))
      return {
        ok: bucket.count <= limit,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        retryAfter,
      }
    },
    reset() {
      buckets.clear()
    },
  }
}
