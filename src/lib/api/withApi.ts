import { createSpan } from '@/lib/telemetry/tracing'
import { handleApiError } from '@/lib/errors/handler'

type RouteContext<TParams> = { params: Promise<TParams> }

type RouteHandler<TParams> = (
  req: Request,
  ctx: RouteContext<TParams>
) => Promise<Response> | Response

/**
 * Wrap a route handler with tracing + typed-error translation.
 *
 * Usage (no params):
 *   export const POST = withApi('approvals.submit', async (req) => { ... })
 *
 * Typed params (dynamic segment):
 *   export const GET = withApi<{ id: string }>('approvals.get', async (_req, { params }) => {
 *     const { id } = await params
 *     ...
 *   })
 *
 * Catch-all segments (`[...slug]`) resolve to `string[]`, so `TParams` accepts
 * `Record<string, string | string[]>`.
 */
export function withApi<
  TParams extends Record<string, string | string[]> = Record<string, never>,
>(
  spanName: string,
  handler: RouteHandler<TParams>
): (req: Request, ctx: RouteContext<TParams>) => Promise<Response> {
  return async (req, ctx) => {
    return createSpan(spanName, async () => handler(req, ctx)).catch(handleApiError)
  }
}
