import { prisma } from '@/lib/prisma'

export interface ChatContext {
  chatId: string
  previousMessages: Array<{ role: string; content: string }>
}

/**
 * Resolves a chat session: creates a new one when chatId is null, verifies an
 * existing one otherwise. Persists the user message and returns the chat id
 * plus the last 20 messages for context.
 *
 * Returns null when the requested chatId does not exist (callers should 404).
 */
export async function resolveChat(
  chatId: string | null,
  userMessage: string
): Promise<ChatContext | null> {
  let currentChatId: string

  if (!chatId) {
    const chat = await prisma.chat.create({
      data: { name: userMessage.slice(0, 50) },
    })
    currentChatId = chat.id
  } else {
    const existing = await prisma.chat.findUnique({ where: { id: chatId } })
    if (!existing) return null
    currentChatId = chatId
  }

  await prisma.message.create({
    data: { role: 'USER', content: userMessage, chatId: currentChatId, userId: null },
  })

  const previousMessages = await prisma.message.findMany({
    where: { chatId: currentChatId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  return { chatId: currentChatId, previousMessages }
}

export async function saveAssistantMessage(chatId: string, content: string): Promise<void> {
  await prisma.message.create({
    data: { role: 'ASSISTANT', content, chatId, userId: null },
  })
}
