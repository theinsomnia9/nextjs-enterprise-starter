import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addClient,
  removeClient,
  broadcastApprovalEvent,
  getClientCount,
  clearClients,
  type ApprovalEventName,
} from '@/lib/approvals/sseServer'

describe('sseServer', () => {
  let mockWriter: WritableStreamDefaultWriter<string>
  let writeCalls: string[] = []

  beforeEach(() => {
    // Clear all clients before each test
    clearClients()
    writeCalls = []
    mockWriter = {
      write: vi.fn((chunk: string) => {
        writeCalls.push(chunk)
        return Promise.resolve()
      }),
      close: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
      closed: Promise.resolve(undefined),
      desiredSize: 1,
      ready: Promise.resolve(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    } as unknown as WritableStreamDefaultWriter<string>
  })

  it('should add a client to the clients set', () => {
    const initialCount = getClientCount()
    addClient(mockWriter)
    expect(getClientCount()).toBe(initialCount + 1)
  })

  it('should remove a client from the clients set', () => {
    addClient(mockWriter)
    const countAfterAdd = getClientCount()
    removeClient(mockWriter)
    expect(getClientCount()).toBe(countAfterAdd - 1)
  })

  it('should broadcast event to all connected clients', async () => {
    const writer1 = { ...mockWriter, write: vi.fn().mockResolvedValue(undefined) }
    const writer2 = { ...mockWriter, write: vi.fn().mockResolvedValue(undefined) }

    addClient(writer1 as unknown as WritableStreamDefaultWriter<string>)
    addClient(writer2 as unknown as WritableStreamDefaultWriter<string>)

    await broadcastApprovalEvent('request:submitted', { requestId: 'abc' })

    expect(writer1.write).toHaveBeenCalledWith(
      'event: request:submitted\ndata: {"requestId":"abc"}\n\n'
    )
    expect(writer2.write).toHaveBeenCalledWith(
      'event: request:submitted\ndata: {"requestId":"abc"}\n\n'
    )
  })

  it('should handle all approval event types', async () => {
    addClient(mockWriter)

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
      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.stringMatching(`event: ${event}\ndata: .*?\n\n`)
      )
    }
  })

  it('should gracefully handle write errors (client disconnected)', async () => {
    const failingWriter = {
      ...mockWriter,
      write: vi.fn().mockRejectedValue(new Error('Connection closed')),
      close: vi.fn().mockResolvedValue(undefined),
    }

    addClient(failingWriter as unknown as WritableStreamDefaultWriter<string>)

    // Should not throw
    await expect(
      broadcastApprovalEvent('request:submitted', { requestId: 'test' })
    ).resolves.not.toThrow()

    // Client should be removed after error
    expect(getClientCount()).toBe(0)
  })

  it('should handle empty clients set gracefully', async () => {
    // No clients added
    await expect(
      broadcastApprovalEvent('request:submitted', { requestId: 'test' })
    ).resolves.not.toThrow()
  })

  it('should get client count correctly', () => {
    expect(getClientCount()).toBe(0)
    addClient(mockWriter)
    expect(getClientCount()).toBe(1)
    addClient({ ...mockWriter } as unknown as WritableStreamDefaultWriter<string>)
    expect(getClientCount()).toBe(2)
  })

  it('should not throw when removing a non-existent client', () => {
    expect(() => removeClient(mockWriter)).not.toThrow()
  })
})

describe('sseServer globalThis singleton', () => {
  let writer: WritableStreamDefaultWriter<string>

  beforeEach(() => {
    const g = globalThis as unknown as { sseClients: Set<unknown> }
    g.sseClients?.clear()
    writer = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
      closed: Promise.resolve(undefined),
      desiredSize: 1,
      ready: Promise.resolve(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    } as unknown as WritableStreamDefaultWriter<string>
  })

  it('uses globalThis.sseClients so all module instances share the same Set', () => {
    const g = globalThis as unknown as { sseClients: Set<unknown> }

    // The module should have initialised the global on import
    expect(g.sseClients).toBeInstanceOf(Set)
  })

  it('addClient mutates globalThis.sseClients directly', () => {
    const g = globalThis as unknown as { sseClients: Set<unknown> }
    const before = g.sseClients.size

    addClient(writer)

    // The global Set must reflect the addition — proves no private copy is used
    expect(g.sseClients.size).toBe(before + 1)
  })

  it('removeClient mutates globalThis.sseClients directly', () => {
    const g = globalThis as unknown as { sseClients: Set<unknown> }
    addClient(writer)
    const after = g.sseClients.size

    removeClient(writer)

    expect(g.sseClients.size).toBe(after - 1)
  })

  it('a second simulated module re-import sees the same clients', () => {
    addClient(writer)

    // Simulate what happens when Next.js loads sseServer.ts in a second route context:
    // the globalThis guard `if (!globalForSSE.sseClients)` means the existing Set is reused.
    const g = globalThis as unknown as { sseClients: Set<unknown> }
    const sameSet = g.sseClients

    // broadcastApprovalEvent iterates `clients` which is aliased to `globalThis.sseClients`
    // so the count seen here must equal what addClient registered
    expect(sameSet.size).toBeGreaterThan(0)
    expect(sameSet.has(writer)).toBe(true)
  })
})
