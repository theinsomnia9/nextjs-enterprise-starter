import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClientProviders } from '@/components/ClientProviders'
import GlobalNav from '@/components/nav/GlobalNav'
import { SessionProvider } from '@/components/auth/session-provider'
import { getSessionForClient } from '@/lib/auth/actor'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Enterprise Boilerplate',
  description:
    'Production-ready Next.js boilerplate with OpenTelemetry, Entra ID, and more',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getSessionForClient()
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientProviders>
          <SessionProvider session={session}>
            <GlobalNav />
            {children}
          </SessionProvider>
        </ClientProviders>
      </body>
    </html>
  )
}
