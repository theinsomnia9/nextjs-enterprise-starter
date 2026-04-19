'use client'

import { useRef, useState, KeyboardEvent } from 'react'
import { useFormStatus } from 'react-dom'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Send message"
      className={cn(
        'flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
        'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'interactive'
      )}
    >
      <Send className="h-4 w-4" />
      <span>Send</span>
    </button>
  )
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const formAction = (formData: FormData) => {
    const value = (formData.get('message') ?? '').toString().trim()
    if (!value) return
    onSend(value)
    setMessage('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex gap-2">
      <input
        type="text"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className={cn(
          'flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm',
          'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
          'placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />
      <SendButton />
    </form>
  )
}
