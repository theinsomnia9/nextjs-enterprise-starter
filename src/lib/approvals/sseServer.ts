import { createSpan } from '@/lib/telemetry/tracing'

export type ApprovalEventName =
  | 'request:submitted'
  | 'request:locked'
  | 'request:unlocked'
  | 'request:approved'
  | 'request:rejected'
  | 'queue:counts'

export interface SSEClient {
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
}

// Use globalThis to share the clients Set across all Next.js module instances.
// Without this, the SSE route and API action routes each get their own Set,
// so broadcasts would always see 0 clients.
const globalForSSE = globalThis as unknown as {
  sseClients: Set<SSEClient>
}

if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = new Set()
}

const clients = globalForSSE.sseClients

export function addClient(client: SSEClient): void {
  clients.add(client)
}

export function removeClient(client: SSEClient): void {
  clients.delete(client)
}

export function getClientCount(): number {
  return clients.size
}

export function clearClients(): void {
  clients.clear()
}

/**
 * Broadcast an approval event to all connected SSE clients.
 * Removes clients whose controller throws (already closed).
 */
export async function broadcastApprovalEvent(
  event: ApprovalEventName,
  data: Record<string, unknown>
): Promise<void> {
  await createSpan('sse.broadcast', async () => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    const dead: SSEClient[] = []

    for (const client of clients) {
      try {
        client.controller.enqueue(client.encoder.encode(message))
      } catch {
        dead.push(client)
      }
    }

    for (const client of dead) {
      try {
        client.controller.close()
      } catch {
        // already closed
      }
      clients.delete(client)
    }
  })
}
