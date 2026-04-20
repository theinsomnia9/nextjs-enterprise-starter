import type { GuardrailNodeData } from './types'

export interface GuardrailResult {
  ok: boolean
  reason?: string
}

export function evaluateGuardrail(input: string, config: GuardrailNodeData): GuardrailResult {
  switch (config.guardrailKind) {
    case 'blocklist': {
      const list = (config.blocklist ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean)
      const lowered = input.toLowerCase()
      const hit = list.find((term) => lowered.includes(term))
      if (hit) return { ok: false, reason: `Blocked term detected: "${hit}"` }
      return { ok: true }
    }
    case 'length': {
      const max = config.maxLength ?? 2000
      if (input.length > max) {
        return { ok: false, reason: `Input exceeds max length of ${max} characters.` }
      }
      return { ok: true }
    }
    case 'relevance': {
      // PLACEHOLDER — a real relevance check should call a small LLM classifier.
      // For the POC, we do a cheap heuristic using topic keywords.
      const topic = (config.topic ?? '').trim().toLowerCase()
      if (!topic) return { ok: true }
      if (!input.toLowerCase().includes(topic)) {
        return {
          ok: false,
          reason: `Input does not appear related to configured topic "${config.topic}".`,
        }
      }
      return { ok: true }
    }
  }
}
