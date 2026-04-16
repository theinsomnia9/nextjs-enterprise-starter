import { http, HttpResponse } from 'msw'
import { chatHandlers } from './chat'
import { approvalHandlers } from './approvals'

export const handlers = [
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),
  ...chatHandlers,
  ...approvalHandlers,
]
