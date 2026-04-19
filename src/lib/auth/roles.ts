export const Role = {
  Admin: 'Admin',
  Approver: 'Approver',
  Requester: 'Requester',
} as const

export type Role = (typeof Role)[keyof typeof Role]

const KNOWN_ROLES: readonly Role[] = [Role.Admin, Role.Approver, Role.Requester]

export function parseRolesClaim(claim: unknown): Role[] {
  if (!Array.isArray(claim)) {
    if (claim !== undefined && claim !== null) {
      console.warn('[auth/roles] roles claim is not an array; defaulting to Requester', { claim })
    }
    return [Role.Requester]
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

  return known.length === 0 ? [Role.Requester] : known
}
