import { vi } from 'vitest'
import type { Role } from '@/lib/auth/roles'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
  getActorId: vi.fn(),
  getSessionForClient: vi.fn(),
}))

export async function setActor(id: string, roles: Role[] = ['User' as Role]) {
  const mod = await import('@/lib/auth/actor')
  vi.mocked(mod.getActor).mockResolvedValue({ id, roles })
  vi.mocked(mod.getActorId).mockResolvedValue(id)
  vi.mocked(mod.getSessionForClient).mockResolvedValue({
    userId: id,
    roles,
    name: null,
    email: null,
    photoUrl: null,
  })
}

export async function clearActor() {
  const mod = await import('@/lib/auth/actor')
  const { AppError, ErrorCode } = await import('@/lib/errors/AppError')
  const err = new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: 'Sign in required',
  })
  vi.mocked(mod.getActor).mockRejectedValue(err)
  vi.mocked(mod.getActorId).mockRejectedValue(err)
  vi.mocked(mod.getSessionForClient).mockResolvedValue(null)
}
