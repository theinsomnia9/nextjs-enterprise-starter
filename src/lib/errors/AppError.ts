export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
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

export const validationError = (message: string, details?: Record<string, unknown>) =>
  new AppError({
    statusCode: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message,
    details,
  })

export const forbidden = (requiredRoles: string[]) =>
  new AppError({
    statusCode: 403,
    code: ErrorCode.FORBIDDEN,
    message: `Requires role: ${requiredRoles.join(' or ')}`,
    details: { requiredRoles },
  })

export const unauthorized = (message = 'Sign in required') =>
  new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message,
  })
