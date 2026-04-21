import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role, parseRolesClaim } from '@/lib/auth/roles'

describe('Role constants', () => {
  it('exposes Admin and User', () => {
    expect(Role.Admin).toBe('Admin')
    expect(Role.User).toBe('User')
  })

  it('does not expose retired roles', () => {
    expect((Role as Record<string, string>).Approver).toBeUndefined()
    expect((Role as Record<string, string>).Requester).toBeUndefined()
  })
})

describe('parseRolesClaim', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => warn.mockClear())

  it('returns known roles as-is', () => {
    expect(parseRolesClaim(['Admin'])).toEqual(['Admin'])
    expect(parseRolesClaim(['User'])).toEqual(['User'])
    expect(parseRolesClaim(['Admin', 'User'])).toEqual(['Admin', 'User'])
  })

  it('defaults to [User] when claim is missing', () => {
    expect(parseRolesClaim(undefined)).toEqual(['User'])
    expect(parseRolesClaim(null)).toEqual(['User'])
  })

  it('defaults to [User] when claim is empty', () => {
    expect(parseRolesClaim([])).toEqual(['User'])
  })

  it('filters out unknown roles (including retired Approver/Requester) and warns', () => {
    expect(parseRolesClaim(['Admin', 'SuperUser', 'Approver'])).toEqual(['Admin'])
    expect(warn).toHaveBeenCalled()
  })

  it('defaults to [User] when all values are unknown', () => {
    expect(parseRolesClaim(['SuperUser', 'God'])).toEqual(['User'])
  })

  it('defaults to [User] when claim is a string (malformed)', () => {
    expect(parseRolesClaim('Admin' as unknown as string[])).toEqual(['User'])
    expect(warn).toHaveBeenCalled()
  })
})
