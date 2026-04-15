import { http, HttpResponse } from 'msw'
import { chatHandlers } from './chat'

export const handlers = [
  // Example handler - extend as needed
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),
  ...chatHandlers,
]
