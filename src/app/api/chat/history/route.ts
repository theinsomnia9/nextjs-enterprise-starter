import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApi } from '@/lib/api/withApi'

export const GET = withApi('chat.history.get', async () => {
  const chats = await prisma.chat.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ chats })
})
