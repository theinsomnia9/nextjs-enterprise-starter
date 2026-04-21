'use client'

import { createContext, use, type ReactNode } from 'react'
import type { Role } from '@/lib/auth/roles'

export type ClientSession = {
  userId: string
  roles: Role[]
  name: string | null
  email: string | null
  photoUrl: string | null
}

export const SessionContext = createContext<ClientSession | null | undefined>(
  undefined
)

export function SessionProvider({
  session,
  children,
}: {
  session: ClientSession | null
  children: ReactNode
}) {
  return <SessionContext value={session}>{children}</SessionContext>
}

export function useSession(): ClientSession | null {
  const ctx = use(SessionContext)
  return ctx ?? null
}
