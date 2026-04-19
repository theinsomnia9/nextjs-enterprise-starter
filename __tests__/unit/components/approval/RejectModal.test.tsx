import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RejectModal } from '@/components/approval/RejectModal'

describe('RejectModal', () => {
  it('calls onConfirm with the reason on submit', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    const textarea = screen.getByPlaceholderText(/describe why/i)
    await userEvent.type(textarea, 'Missing context')
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    expect(onConfirm).toHaveBeenCalledWith('Missing context')
  })

  it('does not call onConfirm when the reason is empty', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancels via Escape key', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    const textarea = screen.getByPlaceholderText(/describe why/i)
    textarea.focus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('cancels via Cancel button', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
