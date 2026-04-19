import { vi } from 'vitest'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
  getActorId: vi.fn(),
  DEV_ACTOR_ID: 'dev-user-alice',
}))

export async function setActor(id: string) {
  const { getActor, getActorId } = await import('@/lib/auth/actor')
  vi.mocked(getActor).mockResolvedValue({ id })
  vi.mocked(getActorId).mockResolvedValue(id)
}
