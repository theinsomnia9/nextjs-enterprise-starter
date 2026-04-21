import { describe, it, expect } from 'vitest'
import {
  AppError,
  ErrorCode,
  notFound,
  validationError,
  unauthorized,
} from '@/lib/errors/AppError'

describe('notFound()', () => {
  it('returns a 404 AppError with NOT_FOUND code', () => {
    const err = notFound('User')
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe(ErrorCode.NOT_FOUND)
    expect(err.message).toBe('User not found')
    expect(err.details).toBeUndefined()
  })

  it('includes the id in details when provided', () => {
    const err = notFound('User', 'abc123')
    expect(err.details).toEqual({ id: 'abc123' })
  })
})

describe('validationError()', () => {
  it('returns a 400 AppError with VALIDATION_ERROR code', () => {
    const err = validationError('name is required')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(err.message).toBe('name is required')
  })

  it('passes through optional details', () => {
    const err = validationError('bad input', { field: 'email' })
    expect(err.details).toEqual({ field: 'email' })
  })
})

describe('unauthorized()', () => {
  it('defaults to "Sign in required" with UNAUTHORIZED code and 401', () => {
    const err = unauthorized()
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(err.message).toBe('Sign in required')
  })

  it('accepts a custom message', () => {
    const err = unauthorized('Session expired')
    expect(err.message).toBe('Session expired')
  })
})

describe('AppError#toJSON', () => {
  it('serializes message, code, and details', () => {
    const err = new AppError({
      statusCode: 400,
      code: ErrorCode.VALIDATION_ERROR,
      message: 'bad',
      details: { field: 'x' },
    })
    expect(err.toJSON()).toEqual({
      error: 'bad',
      code: ErrorCode.VALIDATION_ERROR,
      details: { field: 'x' },
    })
  })

  it('omits details when absent', () => {
    const err = new AppError({
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'boom',
    })
    expect(err.toJSON()).toEqual({
      error: 'boom',
      code: ErrorCode.INTERNAL_ERROR,
    })
  })
})
