export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/telemetry/instrumentation.node')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./lib/telemetry/instrumentation.edge')
  }
}
