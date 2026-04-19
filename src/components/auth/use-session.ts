'use client'

import { useContext } from 'react'
import { SessionContext, type ClientSession } from './session-provider'

export function useSession(): ClientSession | null {
  const ctx = useContext(SessionContext)
  if (ctx === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}

export function useRequiredSession(): ClientSession {
  const s = useSession()
  if (!s) throw new Error('useRequiredSession called without an active session')
  return s
}
