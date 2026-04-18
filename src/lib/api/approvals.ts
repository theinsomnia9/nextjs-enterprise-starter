import { apiClient, ApiError } from './client'
import type { QueueRequest } from '@/components/approval/QueueDashboard'
import type { StatusCounts } from '@/components/approval/ApprovalPipeline'

interface QueueResponse {
  requests: QueueRequest[]
  total: number
  counts: StatusCounts
}

export const approvalApi = {
  getQueue(): Promise<QueueResponse> {
    return apiClient.get('/api/approvals/queue')
  },

  getById(id: string) {
    return apiClient.get(`/api/approvals/${id}`)
  },

  create(data: { title: string; description?: string; category: string; requesterId: string }) {
    return apiClient.post('/api/approvals', data)
  },

  lock(id: string) {
    return apiClient.post(`/api/approvals/${id}/lock`, {})
  },

  release(id: string) {
    return apiClient.post(`/api/approvals/${id}/release`, {})
  },

  approve(id: string) {
    return apiClient.post(`/api/approvals/${id}/approve`, {})
  },

  reject(id: string, reason: string) {
    return apiClient.post(`/api/approvals/${id}/reject`, { reason })
  },
}

export { ApiError }
