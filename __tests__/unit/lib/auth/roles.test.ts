import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role, parseRolesClaim } from '@/lib/auth/roles'

describe('Role constants', () => {
  it('exposes Admin, Approver, Requester', () => {
    expect(Role.Admin).toBe('Admin')
    expect(Role.Approver).toBe('Approver')
    expect(Role.Requester).toBe('Requester')
  })
})

describe('parseRolesClaim', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => warn.mockClear())

  it('returns known roles as-is', () => {
    expect(parseRolesClaim(['Admin'])).toEqual(['Admin'])
    expect(parseRolesClaim(['Approver', 'Admin'])).toEqual(['Approver', 'Admin'])
  })

  it('defaults to [Requester] when claim is missing', () => {
    expect(parseRolesClaim(undefined)).toEqual(['Requester'])
    expect(parseRolesClaim(null)).toEqual(['Requester'])
  })

  it('defaults to [Requester] when claim is empty', () => {
    expect(parseRolesClaim([])).toEqual(['Requester'])
  })

  it('filters out unknown roles and warns', () => {
    expect(parseRolesClaim(['Approver', 'SuperUser', 'Admin'])).toEqual(['Approver', 'Admin'])
    expect(warn).toHaveBeenCalled()
  })

  it('defaults to [Requester] when all values are unknown', () => {
    expect(parseRolesClaim(['SuperUser', 'God'])).toEqual(['Requester'])
  })

  it('defaults to [Requester] when claim is a string (malformed)', () => {
    expect(parseRolesClaim('Admin' as unknown as string[])).toEqual(['Requester'])
    expect(warn).toHaveBeenCalled()
  })
})
