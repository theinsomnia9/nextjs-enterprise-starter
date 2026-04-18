import { createSpan } from '@/lib/telemetry/tracing'

export type ApprovalEventName =
  | 'request:submitted'
  | 'request:locked'
  | 'request:unlocked'
  | 'request:approved'
  | 'request:rejected'
  | 'queue:counts'

// Use globalThis to share the clients Set across all Next.js module instances.
// Without this, the SSE route and API action routes each get their own Set,
// so broadcasts would always see 0 clients.
const globalForSSE = globalThis as unknown as {
  sseClients: Set<WritableStreamDefaultWriter<string>>
}

if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = new Set()
}

const clients = globalForSSE.sseClients

/**
 * Add a new SSE client connection
 */
export function addClient(writer: WritableStreamDefaultWriter<string>): void {
  clients.add(writer)
}

export function removeClient(writer: WritableStreamDefaultWriter<string>): void {
  clients.delete(writer)
}

/**
 * Get the current number of connected clients
 */
export function getClientCount(): number {
  return clients.size
}

/**
 * Clear all clients - useful for testing
 */
export function clearClients(): void {
  clients.clear()
}

/**
 * Broadcast an approval event to all connected SSE clients
 */
export async function broadcastApprovalEvent(
  event: ApprovalEventName,
  data: Record<string, unknown>
): Promise<void> {
  await createSpan('sse.broadcast', async () => {
    // SSE format: event name header + data payload + double newline
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    const deadClients: WritableStreamDefaultWriter<string>[] = []

    for (const client of clients) {
      try {
        await client.write(message)
      } catch {
        // Client disconnected, mark for removal
        deadClients.push(client)
      }
    }

    // Clean up dead clients
    for (const client of deadClients) {
      try {
        await client.close()
      } catch {
        // Ignore close errors
      }
      clients.delete(client)
    }
  })
}

