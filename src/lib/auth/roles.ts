export const Role = {
  Admin: 'Admin',
  User: 'User',
} as const

export type Role = (typeof Role)[keyof typeof Role]

const KNOWN_ROLES: readonly Role[] = [Role.Admin, Role.User]

export function parseRolesClaim(claim: unknown): Role[] {
  if (!Array.isArray(claim)) {
    if (claim !== undefined && claim !== null) {
      console.warn('[auth/roles] roles claim is not an array; defaulting to User', { claim })
    }
    return [Role.User]
  }

  const known: Role[] = []
  const unknown: unknown[] = []
  for (const value of claim) {
    if (typeof value === 'string' && (KNOWN_ROLES as readonly string[]).includes(value)) {
      known.push(value as Role)
    } else {
      unknown.push(value)
    }
  }

  if (unknown.length > 0) {
    console.warn('[auth/roles] filtered unknown role(s) from claim', { unknown })
  }

  return known.length === 0 ? [Role.User] : known
}
