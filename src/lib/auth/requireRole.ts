import { getActor, type Actor } from './actor'
import { forbidden } from '@/lib/errors/AppError'
import type { Role } from './roles'

export function assertRole(actor: { roles: Role[] }, role: Role): void {
  if (!actor.roles.includes(role)) throw forbidden([role])
}

export function assertAnyRole(actor: { roles: Role[] }, roles: readonly Role[]): void {
  const hasAny = roles.some((r) => actor.roles.includes(r))
  if (!hasAny) throw forbidden([...roles])
}

export async function requireRole(role: Role): Promise<Actor> {
  const actor = await getActor()
  assertRole(actor, role)
  return actor
}

export async function requireAnyRole(roles: readonly Role[]): Promise<Actor> {
  const actor = await getActor()
  assertAnyRole(actor, roles)
  return actor
}
