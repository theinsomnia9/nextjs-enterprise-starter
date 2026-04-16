import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('yjs', () => ({
  Doc: vi.fn().mockImplementation(() => ({
    getMap: vi.fn().mockReturnValue(new Map()),
    destroy: vi.fn(),
  })),
}))

vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn().mockImplementation(() => ({
    awareness: {
      setLocalStateField: vi.fn(),
      getStates: vi.fn().mockReturnValue(new Map()),
      on: vi.fn(),
      off: vi.fn(),
    },
    destroy: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

describe('createYjsRoom', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_YJS_HOST = 'localhost'
    process.env.NEXT_PUBLIC_YJS_PORT = '1234'
  })

  it('returns doc, provider, nodesMap, edgesMap, and awareness', async () => {
    const { createYjsRoom } = await import('@/lib/approvals/yjsClient')
    const room = createYjsRoom('test-room')
    expect(room).toHaveProperty('doc')
    expect(room).toHaveProperty('provider')
    expect(room).toHaveProperty('nodesMap')
    expect(room).toHaveProperty('edgesMap')
    expect(room).toHaveProperty('awareness')
  })

  it('uses NEXT_PUBLIC_YJS_HOST and NEXT_PUBLIC_YJS_PORT env vars', async () => {
    const { WebsocketProvider } = await import('y-websocket')
    const { createYjsRoom } = await import('@/lib/approvals/yjsClient')
    createYjsRoom('test-room')
    expect(WebsocketProvider).toHaveBeenCalledWith(
      expect.stringContaining('localhost:1234'),
      'test-room',
      expect.anything()
    )
  })

  it('different roomIds produce independent calls', async () => {
    const { WebsocketProvider } = await import('y-websocket')
    const { createYjsRoom } = await import('@/lib/approvals/yjsClient')
    createYjsRoom('room-a')
    createYjsRoom('room-b')
    const calls = (WebsocketProvider as ReturnType<typeof vi.fn>).mock.calls
    const roomIds = calls.map((c: unknown[]) => c[1])
    expect(roomIds).toContain('room-a')
    expect(roomIds).toContain('room-b')
  })

  it('destroyYjsRoom calls disconnect and destroy on provider', async () => {
    const { createYjsRoom, destroyYjsRoom } = await import('@/lib/approvals/yjsClient')
    const room = createYjsRoom('cleanup-room')
    destroyYjsRoom(room)
    expect(room.provider.disconnect).toHaveBeenCalled()
    expect(room.provider.destroy).toHaveBeenCalled()
  })
})
