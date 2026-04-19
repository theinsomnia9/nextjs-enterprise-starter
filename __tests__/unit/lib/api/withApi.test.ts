import { describe, it, expect, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { notFound } from '@/lib/errors/AppError'

describe('withApi', () => {
  it('returns the handler response on success', async () => {
    const handler = withApi('test.span', async () => NextResponse.json({ ok: true }))
    const req = new Request('http://localhost/api/test')
    const res = await handler(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('translates an AppError into its statusCode + JSON body', async () => {
    const handler = withApi('test.span', async () => {
      throw notFound('Thing', 'id-1')
    })
    const req = new Request('http://localhost/api/test')
    const res = await handler(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('translates unknown errors into a 500 response', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = withApi('test.span', async () => {
      throw new Error('boom')
    })
    const req = new Request('http://localhost/api/test')
    const res = await handler(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
    errorSpy.mockRestore()
  })

  it('passes through route context (params) to the handler', async () => {
    const handler = withApi<{ id: string }>('test.span', async (_req, { params }) => {
      const { id } = await params
      return NextResponse.json({ id })
    })
    const req = new Request('http://localhost/api/test/abc')
    const res = await handler(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(await res.json()).toEqual({ id: 'abc' })
  })
})
