import { redirect } from 'next/navigation'
import { getSessionForClient } from '@/lib/auth/actor'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionForClient()
  if (!session) redirect('/auth/signin')

  return <div className="mx-auto max-w-5xl px-4 pb-16 pt-20">{children}</div>
}
