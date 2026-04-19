import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchUserPhoto } from '@/lib/auth/graph'

const originalFetch = global.fetch

describe('fetchUserPhoto', () => {
  beforeEach(() => {
    // @ts-expect-error override
    global.fetch = vi.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns a data URI on 200', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }) as never
    )
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('returns null on 404 (user has no photo)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('', { status: 404 }) as never)
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toBeNull()
  })

  it('returns null on 401/5xx (do not fail sign-in)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('', { status: 500 }) as never)
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toBeNull()
  })

  it('returns null if fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toBeNull()
  })

  it('sends the access token as a Bearer auth header', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('', { status: 404 }) as never)
    await fetchUserPhoto('fake-access-token')
    const call = vi.mocked(global.fetch).mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer fake-access-token')
  })
})
