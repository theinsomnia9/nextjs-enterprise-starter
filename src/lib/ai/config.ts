import { z } from 'zod'

const nonEmpty = (name: string) =>
  z
    .string({
      required_error: `${name} is required when LLM_PROVIDER=${name.startsWith('AZURE_') ? 'azure-openai' : 'openai'}`,
    })
    .min(
      1,
      `${name} is required when LLM_PROVIDER=${name.startsWith('AZURE_') ? 'azure-openai' : 'openai'}`,
    )

const apiVersionRegex = /^\d{4}-\d{2}-\d{2}(-preview)?$/

const openaiSchema = z.object({
  provider: z.literal('openai'),
  apiKey: nonEmpty('OPENAI_API_KEY'),
  baseUrl: z.string().url('OPENAI_BASE_URL must be a valid URL').optional(),
  chatModel: z.string().min(1).default('gpt-4o-mini'),
})

const azureSchema = z.object({
  provider: z.literal('azure-openai'),
  apiKey: nonEmpty('AZURE_OPENAI_API_KEY'),
  endpoint: z
    .string({
      required_error: 'AZURE_OPENAI_ENDPOINT is required when LLM_PROVIDER=azure-openai',
    })
    .min(1, 'AZURE_OPENAI_ENDPOINT is required when LLM_PROVIDER=azure-openai')
    .url('AZURE_OPENAI_ENDPOINT must be a valid URL'),
  apiVersion: z
    .string({
      required_error: 'AZURE_OPENAI_API_VERSION is required when LLM_PROVIDER=azure-openai',
    })
    .min(1, 'AZURE_OPENAI_API_VERSION is required when LLM_PROVIDER=azure-openai')
    .regex(
      apiVersionRegex,
      'AZURE_OPENAI_API_VERSION must look like YYYY-MM-DD or YYYY-MM-DD-preview',
    ),
  chatDeployment: nonEmpty('AZURE_OPENAI_CHAT_DEPLOYMENT'),
})

const llmConfigSchema = z.discriminatedUnion('provider', [openaiSchema, azureSchema])

export type LlmConfig = z.infer<typeof llmConfigSchema>

function readRaw(): unknown {
  const rawProvider = process.env.LLM_PROVIDER?.trim() || 'openai'

  if (rawProvider === 'openai') {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || undefined,
      chatModel: process.env.OPENAI_CHAT_MODEL || undefined,
    }
  }

  if (rawProvider === 'azure-openai') {
    return {
      provider: 'azure-openai',
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      chatDeployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    }
  }

  // Unknown provider — pass through so discriminatedUnion reports it
  return { provider: rawProvider }
}

export function parseLlmConfig(): LlmConfig {
  const raw = readRaw()
  const parsed = llmConfigSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    // Zod discriminatedUnion emits a generic message when the discriminator
    // value itself is invalid; surface it as an LLM_PROVIDER error instead.
    if (first?.code === 'invalid_union_discriminator') {
      throw new Error(
        `LLM_PROVIDER must be one of: openai, azure-openai (got "${(raw as Record<string, unknown>).provider}")`,
      )
    }
    throw new Error(first?.message ?? 'Invalid LLM configuration')
  }
  return parsed.data
}
