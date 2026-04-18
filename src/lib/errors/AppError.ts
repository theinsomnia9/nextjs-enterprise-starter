export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_RESOLVED = 'ALREADY_RESOLVED',
  LOCKED_BY_OTHER = 'LOCKED_BY_OTHER',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface AppErrorOptions {
  statusCode: number
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: ErrorCode
  public readonly details?: Record<string, unknown>

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.statusCode = options.statusCode
    this.code = options.code
    this.details = options.details
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    }
  }
}

export const notFound = (resource: string, id?: string) =>
  new AppError({
    statusCode: 404,
    code: ErrorCode.NOT_FOUND,
    message: `${resource} not found`,
    ...(id && { details: { id } }),
  })

export const alreadyResolved = () =>
  new AppError({
    statusCode: 409,
    code: ErrorCode.ALREADY_RESOLVED,
    message: 'Request is already resolved',
  })

export const lockedByOther = (lockedBy?: string) =>
  new AppError({
    statusCode: 403,
    code: ErrorCode.LOCKED_BY_OTHER,
    message: 'Request is locked by another reviewer',
    ...(lockedBy && { details: { lockedBy } }),
  })

export const notCurrentReviewer = () =>
  new AppError({
    statusCode: 403,
    code: ErrorCode.UNAUTHORIZED,
    message: 'You are not the current reviewer',
  })

export const validationError = (message: string, details?: Record<string, unknown>) =>
  new AppError({
    statusCode: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message,
    details,
  })
