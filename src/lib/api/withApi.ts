import { NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { handleApiError } from '@/lib/errors/handler'

type RouteContext<TParams> = { params: Promise<TParams> }

type RouteHandler<TParams> = (
  req: Request,
  ctx: RouteContext<TParams>
) => Promise<NextResponse> | NextResponse

/**
 * Wrap a route handler with tracing + typed-error translation.
 * Usage:
 *   export const POST = withApi('approvals.submit', async (req, { params }) => { ... })
 */
export function withApi<TParams extends Record<string, string> = Record<string, never>>(
  spanName: string,
  handler: RouteHandler<TParams>
): (req: Request, ctx: RouteContext<TParams>) => Promise<NextResponse> {
  return async (req, ctx) => {
    return createSpan(spanName, async () => handler(req, ctx)).catch(handleApiError)
  }
}
