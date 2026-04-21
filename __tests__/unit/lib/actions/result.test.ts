import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { wrapAction } from '@/lib/actions/result'
import { AppError, ErrorCode, notFound, lockedByOther } from '@/lib/errors/AppError'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
}))

const { getActor } = await import('@/lib/auth/actor')

describe('wrapAction', () => {
  beforeEach(() => {
    vi.mocked(getActor).mockReset()
  })

  it('returns ok result with data on success', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1', roles: ['Requester'] })
    const result = await wrapAction('test.action', async (actor) => ({ hello: actor.id }))
    expect(result).toEqual({ ok: true, data: { hello: 'user-1' } })
  })

  it('short-circuits with UNAUTHORIZED when getActor throws unauthorized', async () => {
    vi.mocked(getActor).mockRejectedValue(
      new AppError({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: 'not signed in' })
    )
    const cb = vi.fn()
    const result = await wrapAction('test.action', cb)
    expect(cb).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'not signed in' },
    })
  })

  it('translates ZodError to VALIDATION with fields record', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1', roles: ['Requester'] })
    const schema = z.object({ name: z.string().min(1, 'name required') })
    const result = await wrapAction('test.action', async () => {
      schema.parse({ name: '' })
      return null
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fields: { name: 'name required' },
      },
    })
  })

  it('translates AppError to its code and message', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1', roles: ['Requester'] })
    const result = await wrapAction('test.action', async () => {
      throw notFound('Request', 'abc')
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Request not found' },
    })
  })

  it('passes lockedByOther details through unchanged', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1', roles: ['Requester'] })
    const result = await wrapAction('test.action', async () => {
      throw lockedByOther('Bob')
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCKED_BY_OTHER', message: 'Request is locked by another reviewer' },
    })
  })

  it('sanitizes unknown errors to INTERNAL', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1', roles: ['Requester'] })
    const result = await wrapAction('test.action', async () => {
      throw new Error('secret internal detail')
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    })
  })

  it('passes the resolved actor to the callback', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'alice', roles: ['Requester'] })
    const cb = vi.fn().mockResolvedValue('ok')
    await wrapAction('test.action', cb)
    expect(cb).toHaveBeenCalledWith({ id: 'alice', roles: ['Requester'] })
  })
})
