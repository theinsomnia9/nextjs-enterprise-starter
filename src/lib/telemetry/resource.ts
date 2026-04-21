import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating'
import type { Resource } from '@opentelemetry/resources'

export function buildResource(): Resource {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'nextjs-boilerplate',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '0.1.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
  })
}
