import { describe, it, expect } from 'vitest'
import { evaluateGuardrail } from '@/lib/agentTeams/guardrails'
import type { GuardrailNodeData } from '@/lib/agentTeams/types'

const base = {
  kind: 'guardrail' as const,
  label: 'g',
}

describe('evaluateGuardrail', () => {
  it('blocks when a blocklist term appears', () => {
    const cfg: GuardrailNodeData = {
      ...base,
      guardrailKind: 'blocklist',
      blocklist: ['password', 'ssn'],
    }
    expect(evaluateGuardrail("my password is hunter2", cfg).ok).toBe(false)
    expect(evaluateGuardrail('hello world', cfg).ok).toBe(true)
  })

  it('is case-insensitive for blocklist', () => {
    const cfg: GuardrailNodeData = {
      ...base,
      guardrailKind: 'blocklist',
      blocklist: ['Secret'],
    }
    expect(evaluateGuardrail('reveal the SECRET', cfg).ok).toBe(false)
  })

  it('allows empty blocklist', () => {
    const cfg: GuardrailNodeData = { ...base, guardrailKind: 'blocklist', blocklist: [] }
    expect(evaluateGuardrail('anything', cfg).ok).toBe(true)
  })

  it('enforces length cap', () => {
    const cfg: GuardrailNodeData = { ...base, guardrailKind: 'length', maxLength: 10 }
    expect(evaluateGuardrail('short', cfg).ok).toBe(true)
    expect(evaluateGuardrail('way too long indeed', cfg).ok).toBe(false)
  })

  it('enforces relevance topic keyword', () => {
    const cfg: GuardrailNodeData = { ...base, guardrailKind: 'relevance', topic: 'finance' }
    expect(evaluateGuardrail('what is finance', cfg).ok).toBe(true)
    expect(evaluateGuardrail('what is the weather', cfg).ok).toBe(false)
  })

  it('allows all when relevance topic is empty', () => {
    const cfg: GuardrailNodeData = { ...base, guardrailKind: 'relevance' }
    expect(evaluateGuardrail('anything', cfg).ok).toBe(true)
  })
})
