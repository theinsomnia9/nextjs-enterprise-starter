import { describe, it, expect } from 'vitest'
import {
  createTeamSchema,
  runTeamSchema,
  teamDefinitionSchema,
  designTeamSchema,
} from '@/lib/agentTeams/schemas'
import { emptyDefinition } from '@/lib/agentTeams/validator'

describe('agentTeams schemas', () => {
  it('createTeamSchema requires a non-empty name', () => {
    expect(createTeamSchema.safeParse({ name: '' }).success).toBe(false)
    expect(createTeamSchema.safeParse({ name: 'Ok' }).success).toBe(true)
  })

  it('runTeamSchema caps input length', () => {
    const long = 'x'.repeat(10001)
    expect(runTeamSchema.safeParse({ input: long }).success).toBe(false)
    expect(runTeamSchema.safeParse({ input: 'hello' }).success).toBe(true)
  })

  it('teamDefinitionSchema accepts the empty definition', () => {
    const def = emptyDefinition('Sample')
    const parsed = teamDefinitionSchema.safeParse(def)
    expect(parsed.success).toBe(true)
  })

  it('teamDefinitionSchema rejects mismatched discriminator', () => {
    const def = emptyDefinition('Sample')
    // corrupt
    ;(def.nodes[0].data as unknown as { kind: string }).kind = 'agent'
    const parsed = teamDefinitionSchema.safeParse(def)
    expect(parsed.success).toBe(false)
  })

  it('designTeamSchema validates history', () => {
    const res = designTeamSchema.safeParse({
      message: 'hi',
      definition: emptyDefinition('Sample'),
      history: [{ role: 'user', content: 'first' }],
    })
    expect(res.success).toBe(true)
  })
})
