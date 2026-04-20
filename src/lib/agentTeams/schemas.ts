import { z } from 'zod'

const positionSchema = z.object({ x: z.number(), y: z.number() })

const triggerData = z.object({
  kind: z.literal('trigger'),
  label: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
})

const agentData = z.object({
  kind: z.literal('agent'),
  label: z.string().min(1),
  description: z.string().optional(),
  role: z.string().min(1),
  systemPrompt: z.string().min(1).max(8000),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  toolNames: z.array(z.string()),
  maxTurns: z.number().int().min(1).max(20),
})

const toolData = z.object({
  kind: z.literal('tool'),
  label: z.string().min(1),
  description: z.string().optional(),
  toolName: z.string().min(1),
  config: z.record(z.unknown()).optional(),
})

const guardrailData = z.object({
  kind: z.literal('guardrail'),
  label: z.string().min(1),
  description: z.string().optional(),
  guardrailKind: z.enum(['relevance', 'blocklist', 'length']),
  blocklist: z.array(z.string()).optional(),
  maxLength: z.number().int().min(1).max(100000).optional(),
  topic: z.string().optional(),
})

const outputData = z.object({
  kind: z.literal('output'),
  label: z.string().min(1),
  description: z.string().optional(),
  format: z.enum(['text', 'json', 'markdown']),
})

export const nodeDataSchema = z.discriminatedUnion('kind', [
  triggerData,
  agentData,
  toolData,
  guardrailData,
  outputData,
])

export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'agent', 'tool', 'guardrail', 'output']),
  position: positionSchema,
  data: nodeDataSchema,
})

export const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  animated: z.boolean().optional(),
})

export const teamDefinitionSchema = z.object({
  version: z.literal(1),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  metadata: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
  }),
})

export const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  definition: teamDefinitionSchema.optional(),
})

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  definition: teamDefinitionSchema.optional(),
  isActive: z.boolean().optional(),
})

export const runTeamSchema = z.object({
  input: z.string().min(1).max(10000),
})

export const designTeamSchema = z.object({
  message: z.string().min(1).max(4000),
  definition: teamDefinitionSchema,
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20)
    .optional(),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
export type RunTeamInput = z.infer<typeof runTeamSchema>
export type DesignTeamInput = z.infer<typeof designTeamSchema>
