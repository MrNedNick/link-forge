import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { Context } from 'hono'
import type { ZodType } from 'zod'
import { apiError } from './http.js'

/** Only the part of a zod failure this needs — the concrete class differs by target. */
type IssueBag = { issues: readonly { message: string; path: readonly PropertyKey[] }[] }

/**
 * The message stays a plain sentence and the field travels beside it, so the
 * browser can put the text under the input that caused it instead of prefixing
 * every message with a label the form already shows.
 */
function firstProblem(error: IssueBag): { message: string; field?: string } {
  const issue = error.issues[0]
  if (!issue) return { message: 'Check the values and try again.' }

  const field = issue.path.find((part) => typeof part === 'string')
  return { message: issue.message, field: typeof field === 'string' ? field : undefined }
}

/**
 * The same validator everywhere, so a rejected field comes back in the one error
 * shape the client knows. Without this the browser is handed a serialised
 * ZodError and shows a page of JSON where a sentence belongs.
 */
export function valid<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const { message, field } = firstProblem(result.error)
      throw apiError(422, 'invalid', message, field ? { field } : undefined)
    }
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A path id that is not a UUID cannot match a row, and handing it to Postgres
 * raises `invalid input syntax for type uuid` — a 500 for what is plainly a 404.
 */
export function linkId(c: Context): string {
  const id = c.req.param('id')
  if (!id || !UUID.test(id)) throw apiError(404, 'not_found', 'That link is gone.')
  return id
}
