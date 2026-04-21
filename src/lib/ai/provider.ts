import OpenAI, { AzureOpenAI } from 'openai'
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { parseLlmConfig, type LlmConfig } from './config'
import { addSpanAttribute } from '@/lib/telemetry/tracing'

let cachedConfig: LlmConfig | null = null
let cachedClient: OpenAI | null = null

function config(): LlmConfig {
  if (!cachedConfig) {
    cachedConfig = parseLlmConfig()
  }
  return cachedConfig
}

export function getChatClient(): OpenAI {
  const cfg = config()
  addSpanAttribute('ai.provider', cfg.provider)

  if (cachedClient) return cachedClient

  if (cfg.provider === 'azure-openai') {
    cachedClient = new AzureOpenAI({
      apiKey: cfg.apiKey,
      endpoint: cfg.endpoint,
      apiVersion: cfg.apiVersion,
      deployment: cfg.chatDeployment,
    })
  } else {
    cachedClient = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl,
    })
  }
  return cachedClient
}

export interface ChatModelOptions {
  model?: string
  temperature?: number
}

export function getChatModel(opts: ChatModelOptions = {}): BaseChatModel {
  const cfg = config()
  addSpanAttribute('ai.provider', cfg.provider)

  if (cfg.provider === 'azure-openai') {
    return new AzureChatOpenAI({
      azureOpenAIApiKey: cfg.apiKey,
      azureOpenAIEndpoint: cfg.endpoint,
      azureOpenAIApiVersion: cfg.apiVersion,
      azureOpenAIApiDeploymentName: cfg.chatDeployment,
      temperature: opts.temperature,
    })
  }

  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: opts.model ?? cfg.chatModel,
    temperature: opts.temperature,
    configuration: cfg.baseUrl ? { baseURL: cfg.baseUrl } : undefined,
  })
}

export function chatModelName(): string {
  const cfg = config()
  return cfg.provider === 'azure-openai' ? cfg.chatDeployment : cfg.chatModel
}

export function __resetForTests(): void {
  cachedConfig = null
  cachedClient = null
}
