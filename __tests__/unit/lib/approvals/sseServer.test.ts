import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addClient,
  removeClient,
  broadcastApprovalEvent,
  getClientCount,
  clearClients,
  type ApprovalEventName,
  type SSEClient,
} from '@/lib/approvals/sseServer'

function makeClient(overrides: Partial<ReadableStreamDefaultController<Uint8Array>> = {}): SSEClient {
  const controller = {
    enqueue: vi.fn(),
    close: vi.fn(),
    error: vi.fn(),
    ...overrides,
  } as unknown as ReadableStreamDefaultController<Uint8Array>
  return { controller, encoder: new TextEncoder() }
}

describe('sseServer', () => {
  beforeEach(() => {
    clearClients()
  })

  it('adds a client to the clients set', () => {
    const client = makeClient()
    addClient(client)
    expect(getClientCount()).toBe(1)
  })

  it('removes a client from the clients set', () => {
    const client = makeClient()
    addClient(client)
    removeClient(client)
    expect(getClientCount()).toBe(0)
  })

  it('broadcasts event to all connected clients via controller.enqueue', async () => {
    const c1 = makeClient()
    const c2 = makeClient()
    addClient(c1)
    addClient(c2)

    await broadcastApprovalEvent('request:submitted', { requestId: 'abc' })

    const expected = new TextEncoder().encode(
      'event: request:submitted\ndata: {"requestId":"abc"}\n\n'
    )
    expect(c1.controller.enqueue).toHaveBeenCalledWith(expected)
    expect(c2.controller.enqueue).toHaveBeenCalledWith(expected)
  })

  it('handles all approval event types', async () => {
    const client = makeClient()
    addClient(client)

    const events: ApprovalEventName[] = [
      'request:submitted',
      'request:locked',
      'request:unlocked',
      'request:approved',
      'request:rejected',
      'queue:counts',
    ]

    for (const event of events) {
      await broadcastApprovalEvent(event, { test: true })
    }
    expect(client.controller.enqueue).toHaveBeenCalledTimes(events.length)
  })

  it('removes clients whose enqueue throws (disconnected)', async () => {
    const failing = makeClient({
      enqueue: vi.fn(() => {
        throw new Error('Invalid state')
      }) as unknown as ReadableStreamDefaultController<Uint8Array>['enqueue'],
    })
    addClient(failing)

    await expect(
      broadcastApprovalEvent('request:submitted', { requestId: 'test' })
    ).resolves.not.toThrow()

    expect(getClientCount()).toBe(0)
  })

  it('handles empty clients set gracefully', async () => {
    await expect(
      broadcastApprovalEvent('request:submitted', { requestId: 'test' })
    ).resolves.not.toThrow()
  })

  it('does not throw when removing a non-existent client', () => {
    const client = makeClient()
    expect(() => removeClient(client)).not.toThrow()
  })
})

describe('sseServer globalThis singleton', () => {
  beforeEach(() => {
    clearClients()
  })

  it('uses globalThis.sseClients so all module instances share the same Set', () => {
    const g = globalThis as unknown as { sseClients: Set<unknown> }
    expect(g.sseClients).toBeInstanceOf(Set)
  })

  it('addClient mutates globalThis.sseClients directly', () => {
    const g = globalThis as unknown as { sseClients: Set<unknown> }
    const before = g.sseClients.size
    const client = makeClient()
    addClient(client)
    expect(g.sseClients.size).toBe(before + 1)
  })
})
