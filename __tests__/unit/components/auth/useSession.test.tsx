import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { SessionProvider, useSession } from '@/components/auth/session-provider'

function Probe() {
  const session = useSession()
  if (!session) return <span>no-session</span>
  return <span>{session.name}</span>
}

describe('useSession', () => {
  it('returns null when no provider is wrapping', () => {
    render(<Probe />)
    expect(screen.getByText('no-session')).toBeDefined()
  })

  it('returns null when provider value is null', () => {
    render(
      <SessionProvider session={null}>
        <Probe />
      </SessionProvider>
    )
    expect(screen.getByText('no-session')).toBeDefined()
  })

  it('returns the session when provider supplies one', () => {
    render(
      <SessionProvider
        session={{
          userId: 'u1',
          roles: ['Admin'],
          name: 'Alice Example',
          email: 'alice@example.com',
          photoUrl: null,
        }}
      >
        <Probe />
      </SessionProvider>
    )
    expect(screen.getByText('Alice Example')).toBeDefined()
  })
})
