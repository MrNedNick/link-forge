import { hc } from 'hono/client'
import type { AppType } from '../../../server/app'

/**
 * The client is generated from the server's route types — no hand-written
 * response interfaces, and renaming a field on the server breaks the build here
 * rather than at runtime in front of a user.
 */
export const api = hc<AppType>('/', {
  init: { credentials: 'same-origin' },
})

export type ApiErrorShape = {
  code: string
  message: string
  retryAfter?: number
  /** Which input caused this, when the server knows. */
  field?: string
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfter?: number
  readonly field?: string

  constructor(status: number, body: ApiErrorShape) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.retryAfter = body.retryAfter
    this.field = body.field
  }
}

type AnyResponse = { ok: boolean; status: number; json: () => Promise<unknown> }

/** The payload of the success branch of a typed response union. */
type SuccessBody<R> = R extends { ok: true; json: () => Promise<infer T> } ? T : never

type ZodIssues = { error?: { message?: string; issues?: { message?: string }[] } }

/**
 * Unwraps a typed response: the success payload comes back, and every failure —
 * an API error, a validation rejection, an unreadable body — arrives as one
 * `ApiError` for the caller to catch.
 */
export async function unwrap<R extends AnyResponse>(response: R): Promise<SuccessBody<R>> {
  // 204 has no body at all, and calling json() on it throws.
  if (response.status === 204) return undefined as SuccessBody<R>
  if (response.ok) return (await response.json()) as SuccessBody<R>

  let body: ApiErrorShape = { code: 'invalid', message: 'Something went wrong.' }
  try {
    const parsed = (await response.json()) as ZodIssues & { error?: ApiErrorShape }
    const validation = parsed?.error?.issues?.[0]?.message
    if (typeof parsed?.error?.message === 'string') body = parsed.error as ApiErrorShape
    else if (validation) body = { code: 'invalid', message: validation }
  } catch {
    if (response.status === 401) body = { code: 'unauthorized', message: 'Sign in to continue.' }
  }
  throw new ApiError(response.status, body)
}

/** The input an error belongs under, so a form can show it in the right place. */
export function errorField(error: unknown): string | undefined {
  return error instanceof ApiError ? error.field : undefined
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return 'Cannot reach the server. Check your connection.'
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong.'
}
