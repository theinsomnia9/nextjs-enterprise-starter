import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

import { render, screen } from '../../../setup/test-utils'
import { requireRole } from '@/lib/auth/requireRole'
import { redirect } from 'next/navigation'
import AdminSettings from '@/app/(protected)/settings/admin/page'
import { AppError, ErrorCode } from '@/lib/errors/AppError'

describe('Settings/Admin page', () => {
  it('renders for an Admin actor', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'u1', roles: ['Admin'] })
    render(await AdminSettings())
    expect(screen.getByRole('heading', { name: /admin/i })).toBeInTheDocument()
    expect(requireRole).toHaveBeenCalledWith('Admin')
  })

  it('redirects to /auth/unauthorized when requireRole throws FORBIDDEN', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new AppError({
        statusCode: 403,
        code: ErrorCode.FORBIDDEN,
        message: 'Forbidden',
      })
    )
    await expect(AdminSettings()).rejects.toThrow(
      /NEXT_REDIRECT:\/auth\/unauthorized\?reason=forbidden/
    )
    expect(redirect).toHaveBeenCalledWith('/auth/unauthorized?reason=forbidden')
  })

  it('re-throws non-FORBIDDEN errors', async () => {
    const boom = new Error('kaboom')
    vi.mocked(requireRole).mockRejectedValue(boom)
    await expect(AdminSettings()).rejects.toBe(boom)
  })
})
