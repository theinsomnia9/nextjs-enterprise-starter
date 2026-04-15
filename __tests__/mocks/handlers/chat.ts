import { http, HttpResponse } from 'msw'

export const chatHandlers = [
  http.get('/api/chat/history', () => {
    return HttpResponse.json({
      chats: [
        {
          id: 'chat-1',
          name: 'Test Chat 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'chat-2',
          name: 'Test Chat 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    })
  }),

  http.get('/api/chat/:chatId/messages', ({ params }) => {
    return HttpResponse.json({
      messages: [
        {
          id: 'msg-1',
          role: 'USER',
          content: 'Hello',
        },
        {
          id: 'msg-2',
          role: 'ASSISTANT',
          content: 'Hi there!',
        },
      ],
    })
  }),

  http.post('/api/chat', async () => {
    return HttpResponse.json({
      chatId: 'new-chat-3',
      message: {
        id: 'msg-3',
        role: 'ASSISTANT',
        content: 'This is a response',
      },
    })
  }),
]
