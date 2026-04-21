/**
 * End-to-end telemetry integration test for Example 1 (agentTeamService.update).
 *
 * Wires in-memory OTel exporters, invokes the real service against the test DB,
 * and asserts that one span, one counter increment, one histogram observation,
 * and one log record were emitted with correlated trace/span IDs.
 *
 * Providers must be registered before the service module is loaded so that the
 * module-level createCounter/createHistogram calls bind to the in-memory exporter
 * rather than the default no-op provider.  Dynamic import inside beforeAll
 * achieves this without mocking.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NodeTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import {
  MeterProvider,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics'
import { LoggerProvider, InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { logs } from '@opentelemetry/api-logs'
import { trace, metrics } from '@opentelemetry/api'

import { prisma } from '@/lib/prisma'
import { buildResource } from '@/lib/telemetry/resource'

const spanExporter = new InMemorySpanExporter()
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
const logExporter = new InMemoryLogRecordExporter()

const tracerProvider = new NodeTracerProvider({
  resource: buildResource(),
  spanProcessors: [new SimpleSpanProcessor(spanExporter)],
})
const meterProvider = new MeterProvider({
  resource: buildResource(),
  readers: [new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 100 })],
})
const loggerProvider = new LoggerProvider({
  resource: buildResource(),
  processors: [new SimpleLogRecordProcessor(logExporter)],
})

// register() sets the global tracer provider AND installs the async context
// manager (AsyncLocalStorage), which is required for trace context to propagate
// across await boundaries inside startActiveSpan callbacks.
tracerProvider.register()
metrics.setGlobalMeterProvider(meterProvider)
logs.setGlobalLoggerProvider(loggerProvider)

describe('telemetry pipeline — agentTeamService.update', () => {
  let userId: string
  let teamId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let svc: any

  beforeAll(async () => {
    // Dynamic import AFTER providers are registered so that module-level
    // createCounter/createHistogram in agentTeamService bind to the real MeterProvider.
    const { AgentTeamService } = await import('@/services/agentTeamService')
    const { agentTeamRepository } = await import('@/lib/agentTeams/repository')
    svc = new AgentTeamService({ repository: agentTeamRepository })

    const u = await prisma.user.create({
      data: { entraOid: `oid-${Date.now()}`, email: `t${Date.now()}@test.local`, name: 'Test' },
    })
    userId = u.id
    const team = await svc.create({
      name: 'Integration Team',
      description: null,
      createdById: userId,
    })
    teamId = team.id
  })

  afterAll(async () => {
    await prisma.workflow.deleteMany({ where: { id: teamId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await tracerProvider.shutdown()
    await meterProvider.shutdown()
    await loggerProvider.shutdown()
  })

  it('emits a span, counter increment, histogram observation, and a correlated log record', async () => {
    spanExporter.reset()
    metricExporter.reset()
    logExporter.reset()

    await svc.update(teamId, userId, { name: 'Renamed' })

    // wait for the metric reader to flush
    await new Promise((r) => setTimeout(r, 200))
    await meterProvider.forceFlush()
    await loggerProvider.forceFlush()
    await tracerProvider.forceFlush()

    const spans = spanExporter.getFinishedSpans()
    const updateSpan = spans.find((s) => s.name === 'team.update')
    expect(updateSpan).toBeDefined()

    const metricsData = metricExporter.getMetrics()
    const allMetrics = metricsData.flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics))
    const saveTotal = allMetrics.find((m) => m.descriptor.name === 'agent_team.save.total')
    const saveDuration = allMetrics.find((m) => m.descriptor.name === 'agent_team.save.duration')
    expect(saveTotal).toBeDefined()
    expect(saveDuration).toBeDefined()

    const saveLog = logExporter.getFinishedLogRecords().find((lr) => lr.body === 'agent_team.save')
    expect(saveLog).toBeDefined()
    expect(saveLog!.attributes!.trace_id).toBe(updateSpan!.spanContext().traceId)
    expect(saveLog!.attributes!.teamId).toBe(teamId)
    expect(saveLog!.attributes!.result).toBe('ok')
  })
})
