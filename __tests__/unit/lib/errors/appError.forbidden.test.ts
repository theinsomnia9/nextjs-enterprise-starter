import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode, forbidden } from '@/lib/errors/AppError'

describe('forbidden()', () => {
  it('returns an AppError with 403 + FORBIDDEN code', () => {
    const err = forbidden(['Admin'])
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('includes the required role(s) in the message', () => {
    const single = forbidden(['Admin'])
    expect(single.message).toBe('Requires role: Admin')
    const multi = forbidden(['Approver', 'Admin'])
    expect(multi.message).toBe('Requires role: Approver or Admin')
  })

  it('attaches requiredRoles in details', () => {
    const err = forbidden(['Approver', 'Admin'])
    expect(err.details).toEqual({ requiredRoles: ['Approver', 'Admin'] })
  })
})
