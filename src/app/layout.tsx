import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ThemeToggle from '@/components/theme/ThemeToggle'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Enterprise Boilerplate',
  description: 'Production-ready Next.js boilerplate with OpenTelemetry, Entra ID, and more',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  )
}
