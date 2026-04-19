import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../../setup/test-utils'
import { ChatInput } from '@/components/chat/ChatInput'

describe('ChatInput', () => {
  it('should render input field and send button', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />)

    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('should call onSend with trimmed message when form is submitted', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: '  Test message  ' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Test message')
    })
  })

  it('should clear input after sending', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement
    const sendButton = screen.getByRole('button', { name: /send/i })

    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('should not call onSend for empty messages', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const sendButton = screen.getByRole('button', { name: /send/i })
    fireEvent.click(sendButton)

    await new Promise((r) => setTimeout(r, 0))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('should disable input when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />)

    const input = screen.getByPlaceholderText('Type your message...')
    expect(input).toBeDisabled()
  })

  it('should support Enter key to send message', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText('Type your message...')

    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Test message')
    })
  })

  it('should not submit on Shift+Enter', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText('Type your message...')

    fireEvent.change(input, { target: { value: 'line' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true })

    await new Promise((r) => setTimeout(r, 0))
    expect(onSend).not.toHaveBeenCalled()
  })
})
