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

  const describe = (count: number, resetAt: number, at: number): RateLimitResult => ({
    ok: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfter: count <= limit ? 0 : Math.max(1, Math.ceil((resetAt - at) / 1000)),
  })

  return {
    limit,

    /** Records one use and reports whether it was within the limit. */
    hit(key: string): RateLimitResult {
      const at = now()
      sweep(at)
      const bucket = buckets.get(key)

      if (!bucket || bucket.resetAt <= at) {
        const fresh = { count: 1, resetAt: at + windowMs }
        buckets.set(key, fresh)
        return describe(fresh.count, fresh.resetAt, at)
      }

      bucket.count += 1
      return describe(bucket.count, bucket.resetAt, at)
    },

    /**
     * Reports the current state without recording anything — for limits that
     * should only count failures, so a valid request never spends the budget.
     */
    peek(key: string): RateLimitResult {
      const at = now()
      const bucket = buckets.get(key)
      if (!bucket || bucket.resetAt <= at) return describe(0, at, at)
      return describe(bucket.count, bucket.resetAt, at)
    },

    reset() {
      buckets.clear()
    },
  }
}
