import { authConfig } from './config'

export type CookieOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge: number
}

const isHttps = authConfig.appUrl.startsWith('https://')

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: authConfig.sessionTtlSeconds,
  }
}

export function clearSessionCookieOptions(): CookieOptions {
  return { ...sessionCookieOptions(), maxAge: 0 }
}

export function oauthPendingCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/auth/callback',
    maxAge: authConfig.oauthPendingTtlSeconds,
  }
}

export function clearOauthPendingCookieOptions(): CookieOptions {
  return { ...oauthPendingCookieOptions(), maxAge: 0 }
}

export function validateReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  // Block whitespace-leading sneaks: URL parsing would normalize
  if (/^\s/.test(value)) return null
  return value
}

export const OAUTH_PENDING_COOKIE = authConfig.oauthPendingCookieName
export const SESSION_COOKIE = authConfig.sessionCookieName
