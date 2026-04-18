import { NextResponse } from 'next/server'
import { AppError, ErrorCode } from './AppError'

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode })
  }

  if (error instanceof Error) {
    console.error('[API Error]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error', code: ErrorCode.INTERNAL_ERROR },
      { status: 500 }
    )
  }

  console.error('[Unknown API Error]', error)
  return NextResponse.json(
    { error: 'Internal server error', code: ErrorCode.INTERNAL_ERROR },
    { status: 500 }
  )
}
