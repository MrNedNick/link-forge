import type { InferResponseType } from 'hono/client'
import type { api } from './client'

// The second parameter picks the success status, dropping the 400 branch that
// the request validators add to every endpoint's response union.
export type LinksResponse = InferResponseType<typeof api.api.links.$get, 200>
export type LinkItem = LinksResponse['items'][number]

export type Overview = InferResponseType<typeof api.api.stats.overview.$get, 200>
export type BreakdownRow = Overview['sources'][number]
export type DayPoint = Overview['days'][number]
export type RecentClick = Overview['recent'][number]

export type LinkStats = InferResponseType<(typeof api.api.links)[':id']['stats']['$get'], 200>

export type SortKey = 'created' | 'clicks' | 'code'
export type SortDir = 'asc' | 'desc'
