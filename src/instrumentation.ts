export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/telemetry/instrumentation.node.js')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./lib/telemetry/instrumentation.edge.js')
  }
}
