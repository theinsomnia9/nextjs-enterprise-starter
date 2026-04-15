'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/providers/ThemeProvider'

export function ClientProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
