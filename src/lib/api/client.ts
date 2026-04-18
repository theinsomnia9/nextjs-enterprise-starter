const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class ApiClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(options: { baseUrl?: string; headers?: Record<string, string> } = {}) {
    this.baseUrl = options.baseUrl ?? API_BASE
    this.defaultHeaders = { 'Content-Type': 'application/json', ...options.headers }
  }

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: this.defaultHeaders,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new ApiError(response.status, (err as { error?: string }).error ?? `HTTP ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request('GET', endpoint)
  }

  post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request('POST', endpoint, body)
  }

  patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request('PATCH', endpoint, body)
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request('DELETE', endpoint)
  }
}

export const apiClient = new ApiClient()
