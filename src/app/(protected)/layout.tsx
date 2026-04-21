import { redirect } from 'next/navigation'
import { getSessionForClient } from '@/lib/auth/actor'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionForClient()
  if (!session) redirect('/auth/signin')
  return <>{children}</>
}
