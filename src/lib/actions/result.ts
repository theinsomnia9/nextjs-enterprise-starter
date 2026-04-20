// Server Actions cross a serialization boundary at runtime. Args and results MUST
// be structurally cloneable: no Dates (use ISO strings), no class instances, no
// functions. ActionResult<T> below intentionally uses only plain objects.

import { ZodError } from 'zod'
import { createSpan } from '@/lib/telemetry/tracing'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { getActor, type Actor } from '@/lib/auth/actor'

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: {
        code: string
        message: string
        fields?: Record<string, string>
      }
    }

function zodFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of err.errors) {
    const path = issue.path.join('.')
    if (!(path in out)) out[path] = issue.message
  }
  return out
}

export async function wrapAction<T>(
  actionName: string,
  fn: (actor: Actor) => Promise<T>
): Promise<ActionResult<T>> {
  let actor: Actor
  try {
    actor = await getActor()
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: { code: err.code, message: err.message } }
    }
    return { ok: false, error: { code: ErrorCode.UNAUTHORIZED, message: 'Sign in required' } }
  }

  return createSpan(`action.${actionName}`, async (span) => {
    span.setAttribute('actor.id', actor.id)
    span.setAttribute('action.name', actionName)

    try {
      const data = await fn(actor)
      return { ok: true, data } satisfies ActionResult<T>
    } catch (err) {
      if (err instanceof ZodError) {
        return {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input',
            fields: zodFields(err),
          },
        } satisfies ActionResult<T>
      }
      if (err instanceof AppError) {
        return {
          ok: false,
          error: { code: err.code, message: err.message },
        } satisfies ActionResult<T>
      }
      console.error({
        action: actionName,
        actorId: actor.id,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      })
      return {
        ok: false,
        error: { code: ErrorCode.INTERNAL_ERROR, message: 'Something went wrong' },
      } satisfies ActionResult<T>
    }
  })
}
