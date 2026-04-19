import { getActor, type Actor } from './actor'
import { forbidden } from '@/lib/errors/AppError'
import type { Role } from './roles'

export async function requireRole(role: Role): Promise<Actor> {
  const actor = await getActor()
  if (!actor.roles.includes(role)) throw forbidden([role])
  return actor
}

export async function requireAnyRole(roles: readonly Role[]): Promise<Actor> {
  const actor = await getActor()
  const hasAny = roles.some((r) => actor.roles.includes(r))
  if (!hasAny) throw forbidden([...roles])
  return actor
}
