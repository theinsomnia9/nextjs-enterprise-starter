import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { ChatMessage } from '@/components/chat/ChatMessage'

describe('ChatMessage', () => {
  it('should render user message with correct styling', () => {
    render(<ChatMessage role="USER" content="Hello, how are you?" isStreaming={false} />)

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('should render assistant message with correct styling', () => {
    render(
      <ChatMessage role="ASSISTANT" content="I'm doing well, thank you!" isStreaming={false} />
    )

    expect(screen.getByText("I'm doing well, thank you!")).toBeInTheDocument()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
  })

  it('should show streaming indicator when message is streaming', () => {
    render(<ChatMessage role="ASSISTANT" content="Typing..." isStreaming={true} />)

    expect(screen.getByText('Typing...')).toBeInTheDocument()
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument()
  })

  it('should use theme-based background colors', () => {
    const { container: userContainer } = render(
      <ChatMessage role="USER" content="Test message" isStreaming={false} />
    )

    expect(userContainer.firstChild).toHaveClass('bg-primary/5')

    const { container: assistantContainer } = render(
      <ChatMessage role="ASSISTANT" content="Test message" isStreaming={false} />
    )

    expect(assistantContainer.firstChild).toHaveClass('bg-muted')
  })
})
