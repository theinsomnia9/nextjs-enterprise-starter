import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn((attrs: Record<string, unknown>) => ({ attributes: attrs })),
}))

vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}))

vi.mock('@opentelemetry/semantic-conventions/incubating', () => ({
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME: 'deployment.environment',
}))

describe('buildResource', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults service.name to nextjs-boilerplate when OTEL_SERVICE_NAME unset', async () => {
    vi.stubEnv('OTEL_SERVICE_NAME', '')
    vi.stubEnv('OTEL_SERVICE_VERSION', '')
    vi.stubEnv('NODE_ENV', '')
    const { buildResource } = await import('@/lib/telemetry/resource')
    const r = buildResource() as { attributes: Record<string, string> }
    expect(r.attributes['service.name']).toBe('nextjs-boilerplate')
    expect(r.attributes['service.version']).toBe('0.1.0')
    expect(r.attributes['deployment.environment']).toBe('development')
  })

  it('reads OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION, NODE_ENV from env', async () => {
    vi.stubEnv('OTEL_SERVICE_NAME', 'my-service')
    vi.stubEnv('OTEL_SERVICE_VERSION', '9.9.9')
    vi.stubEnv('NODE_ENV', 'production')
    const { buildResource } = await import('@/lib/telemetry/resource')
    const r = buildResource() as { attributes: Record<string, string> }
    expect(r.attributes['service.name']).toBe('my-service')
    expect(r.attributes['service.version']).toBe('9.9.9')
    expect(r.attributes['deployment.environment']).toBe('production')
  })
})
