import { http, HttpResponse } from 'msw'

const mockRequest = {
  id: 'req-1',
  title: 'Deploy to production',
  description: 'Deploy v2.1.0',
  category: 'P1',
  status: 'PENDING',
  priorityScore: 100,
  requesterId: 'user-1',
  requester: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  assigneeId: null,
  assignee: null,
  lockedAt: null,
  lockExpiresAt: null,
  approvedById: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  submittedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const approvalHandlers = [
  http.get('/api/approvals/queue', () => {
    return HttpResponse.json({ requests: [mockRequest], total: 1 })
  }),

  http.post('/api/approvals', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...mockRequest, title: body.title as string, id: 'req-new' },
      { status: 201 }
    )
  }),

  http.post('/api/approvals/:id/lock', ({ params }) => {
    return HttpResponse.json({
      ...mockRequest,
      id: params.id as string,
      status: 'REVIEWING',
      assigneeId: 'user-2',
      lockedAt: new Date().toISOString(),
      lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
  }),

  http.post('/api/approvals/:id/release', ({ params }) => {
    return HttpResponse.json({
      ...mockRequest,
      id: params.id as string,
      status: 'PENDING',
      assigneeId: null,
      lockedAt: null,
      lockExpiresAt: null,
    })
  }),

  http.post('/api/approvals/:id/approve', ({ params }) => {
    return HttpResponse.json({
      ...mockRequest,
      id: params.id as string,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedById: 'user-2',
    })
  }),

  http.post('/api/approvals/:id/reject', ({ params }) => {
    return HttpResponse.json({
      ...mockRequest,
      id: params.id as string,
      status: 'REJECTED',
      rejectedAt: new Date().toISOString(),
      rejectionReason: 'Does not meet requirements',
    })
  }),
]
