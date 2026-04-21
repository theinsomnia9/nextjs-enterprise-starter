import { describe, it, expect } from 'vitest'
import {
  initialsFor,
  roleBadgeClasses,
} from '@/components/auth/userMenuHelpers'

describe('initialsFor', () => {
  it('returns first and last initials for a multi-word name', () => {
    expect(initialsFor({ name: 'Alice Example', email: null })).toBe('AE')
  })

  it('returns first and last initials even with extra whitespace', () => {
    expect(initialsFor({ name: '  Alice   Middle Example  ', email: null })).toBe(
      'AE'
    )
  })

  it('returns first two chars for a single-token name', () => {
    expect(initialsFor({ name: 'Alice', email: null })).toBe('AL')
  })

  it('falls back to email local part when name is null', () => {
    expect(initialsFor({ name: null, email: 'alice@example.com' })).toBe('AL')
  })

  it('returns "?" when name and email are both null', () => {
    expect(initialsFor({ name: null, email: null })).toBe('?')
  })

  it('returns "?" when name is only whitespace and no email', () => {
    expect(initialsFor({ name: '   ', email: null })).toBe('?')
  })
})

describe('roleBadgeClasses', () => {
  it('returns primary classes for Admin', () => {
    expect(roleBadgeClasses('Admin')).toMatch(/bg-primary/)
  })

  it('returns secondary classes for Approver', () => {
    expect(roleBadgeClasses('Approver')).toMatch(/bg-secondary/)
  })

  it('returns muted classes for Requester', () => {
    expect(roleBadgeClasses('Requester')).toMatch(/bg-muted/)
  })
})
