import { http, HttpResponse } from 'msw'

export const handlers = [
  // Example handler - extend as needed
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),
]
