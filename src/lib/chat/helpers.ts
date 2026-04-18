import { prisma } from '@/lib/prisma'

export interface ChatContext {
  chatId: string
  previousMessages: Array<{ role: string; content: string }>
}

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
