import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionProvider } from '@/components/auth/session-provider'
import { useSession } from '@/components/auth/use-session'

function Consumer() {
  const s = useSession()
  return <div>{s ? `${s.userId}:${s.roles.join(',')}` : 'no-session'}</div>
}

describe('SessionProvider / useSession', () => {
  it('provides the session to consumers', () => {
    render(
      <SessionProvider session={{ userId: 'u_1', roles: ['Admin'], name: 'A', email: null, photoUrl: null }}>
        <Consumer />
      </SessionProvider>
    )
    expect(screen.getByText('u_1:Admin')).toBeInTheDocument()
  })

  it('exposes null when session is null (public surface)', () => {
    render(
      <SessionProvider session={null}>
        <Consumer />
      </SessionProvider>
    )
    expect(screen.getByText('no-session')).toBeInTheDocument()
  })

  it('throws when useSession is called outside a provider', () => {
    const origError = console.error
    console.error = () => {}
    expect(() => render(<Consumer />)).toThrow(/SessionProvider/)
    console.error = origError
  })
})
