'use client'

import { useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

interface RejectModalProps {
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40"
    >
      {pending ? 'Rejecting…' : 'Reject'}
    </button>
  )
}

export function RejectModal({ onConfirm, onCancel }: RejectModalProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const formAction = (formData: FormData) => {
    const reason = (formData.get('reason') ?? '').toString().trim()
    if (!reason) return
    onConfirm(reason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Rejection reason</h2>
        <form action={formAction}>
          <textarea
            ref={inputRef}
            name="reason"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
            placeholder="Describe why this request is being rejected…"
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}
