import type { Role } from '@/lib/auth/roles'

export function initialsFor({
  name,
  email,
}: {
  name: string | null
  email: string | null
}): string {
  const trimmedName = name?.trim() ?? ''
  if (trimmedName.length > 0) {
    const tokens = trimmedName.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      const first = tokens[0]!.charAt(0)
      const last = tokens[tokens.length - 1]!.charAt(0)
      return (first + last).toUpperCase()
    }
    return tokens[0]!.slice(0, 2).toUpperCase()
  }

  const local = email?.split('@')[0]?.trim() ?? ''
  if (local.length > 0) {
    return local.slice(0, 2).toUpperCase()
  }
  return '?'
}

const BADGE_BASE =
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide'

export function roleBadgeClasses(role: Role): string {
  switch (role) {
    case 'Admin':
      return `${BADGE_BASE} bg-primary text-primary-foreground`
    case 'Approver':
      return `${BADGE_BASE} bg-secondary text-secondary-foreground`
    default:
      return `${BADGE_BASE} bg-muted text-muted-foreground`
  }
}

export function primaryRole(roles: readonly Role[]): Role {
  if (roles.includes('Admin')) return 'Admin'
  if (roles.includes('Approver')) return 'Approver'
  return 'Requester'
}
