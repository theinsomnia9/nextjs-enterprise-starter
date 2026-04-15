'use client'

import { useState, FormEvent, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className={cn(
          'flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm',
          'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500',
          'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        aria-label="Send message"
        className={cn(
          'flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white',
          'hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <Send className="h-4 w-4" />
        <span>Send</span>
      </button>
    </form>
  )
}
