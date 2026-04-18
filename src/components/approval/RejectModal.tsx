'use client'

import { useEffect, useRef } from 'react'

interface RejectModalProps {
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function RejectModal({ onConfirm, onCancel }: RejectModalProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const reasonRef = useRef('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Rejection reason</h2>
        <textarea
          ref={inputRef}
          onChange={(e) => {
            reasonRef.current = e.target.value
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onConfirm(reasonRef.current)
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Describe why this request is being rejected…"
          rows={4}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reasonRef.current)}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
