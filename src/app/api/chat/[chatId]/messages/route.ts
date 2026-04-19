import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/lib/api/withApi'

export const GET = withApi<{ chatId: string }>('chat.messages.get', async (_req, { params }) => {
  const { chatId } = await params
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ messages })
})
