import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn(),
}))

import { render, screen } from '../../../setup/test-utils'
import { requireRole } from '@/lib/auth/requireRole'
import AdminSettings from '@/app/(protected)/settings/admin/page'
import { AppError, ErrorCode } from '@/lib/errors/AppError'

describe('Settings/Admin page', () => {
  it('renders for an Admin actor', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'u1', roles: ['Admin'] })
    render(await AdminSettings())
    expect(screen.getByRole('heading', { name: /admin/i })).toBeInTheDocument()
    expect(requireRole).toHaveBeenCalledWith('Admin')
  })

  it('propagates AppError when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new AppError({
        statusCode: 403,
        code: ErrorCode.FORBIDDEN,
        message: 'Forbidden',
      })
    )
    await expect(AdminSettings()).rejects.toBeInstanceOf(AppError)
  })
})
