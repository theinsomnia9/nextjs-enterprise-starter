import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '../../../setup/test-utils'
import { ApprovalPipeline } from '@/components/approval/ApprovalPipeline'

const mockCounts = { PENDING: 3, REVIEWING: 1, APPROVED: 12, REJECTED: 2 }

type MockEventSourceInstance = InstanceType<typeof EventSource> & {
  simulateEvent: (type: string, data: unknown) => void
  simulateMessage: (data: string) => void
}

let lastEventSource: MockEventSourceInstance | null = null

describe('ApprovalPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastEventSource = null

    const RealMockES = global.EventSource
    vi.stubGlobal(
      'EventSource',
      vi.fn(function (url: string) {
        const instance = new RealMockES(url) as MockEventSourceInstance
        lastEventSource = instance
        return instance
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the pipeline container', () => {
    render(<ApprovalPipeline counts={mockCounts} />)
    expect(screen.getByTestId('approval-pipeline')).toBeDefined()
  })

  it('renders PENDING, REVIEWING, APPROVED, REJECTED stage labels', () => {
    render(<ApprovalPipeline counts={mockCounts} />)
    expect(screen.getByText('PENDING')).toBeDefined()
    expect(screen.getByText('REVIEWING')).toBeDefined()
    expect(screen.getByText('APPROVED')).toBeDefined()
    expect(screen.getByText('REJECTED')).toBeDefined()
  })

  it('displays the correct count values', () => {
    render(<ApprovalPipeline counts={mockCounts} />)
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('connects to /api/sse/approvals on mount', () => {
    render(<ApprovalPipeline counts={mockCounts} />)
    expect(global.EventSource).toHaveBeenCalledWith('/api/sse/approvals')
  })

  it('closes the EventSource on unmount', () => {
    const { unmount } = render(<ApprovalPipeline counts={mockCounts} />)
    expect(lastEventSource).not.toBeNull()
    const closeSpy = vi.spyOn(lastEventSource!, 'close')
    unmount()
    expect(closeSpy).toHaveBeenCalled()
  })

  it.each([
    'request:submitted',
    'request:locked',
    'request:unlocked',
    'request:approved',
    'request:rejected',
    'queue:counts',
  ])('calls onRefresh when named event "%s" is received', async (eventName) => {
    const onRefresh = vi.fn()
    render(<ApprovalPipeline counts={mockCounts} onRefresh={onRefresh} />)

    expect(lastEventSource).not.toBeNull()

    await act(async () => {
      lastEventSource!.simulateEvent(eventName, { requestId: 'test-id' })
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onRefresh for unknown event types', async () => {
    const onRefresh = vi.fn()
    render(<ApprovalPipeline counts={mockCounts} onRefresh={onRefresh} />)

    await act(async () => {
      lastEventSource!.simulateEvent('some:unknown:event', { requestId: 'test-id' })
    })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('updates displayed counts when counts prop changes', () => {
    const { rerender } = render(<ApprovalPipeline counts={mockCounts} />)
    expect(screen.getByText('3')).toBeDefined()

    rerender(
      <ApprovalPipeline counts={{ PENDING: 99, REVIEWING: 1, APPROVED: 12, REJECTED: 2 }} />
    )
    expect(screen.getByText('99')).toBeDefined()
  })

  it('does not crash when onRefresh is not provided and an SSE event fires', async () => {
    render(<ApprovalPipeline counts={mockCounts} />)

    await expect(
      act(async () => {
        lastEventSource!.simulateEvent('request:approved', { requestId: 'test-id' })
      })
    ).resolves.not.toThrow()
  })
})
