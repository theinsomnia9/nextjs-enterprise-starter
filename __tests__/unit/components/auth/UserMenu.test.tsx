import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../../../setup/test-utils'
import UserMenu from '@/components/auth/UserMenu'
import { SessionProvider } from '@/components/auth/session-provider'

const mockUsePathname = vi.fn<() => string>(() => '/')
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

function renderWith(
  session: Parameters<typeof SessionProvider>[0]['session'],
  pathname = '/'
) {
  mockUsePathname.mockReturnValue(pathname)
  return render(
    <SessionProvider session={session}>
      <UserMenu />
    </SessionProvider>
  )
}

describe('UserMenu', () => {
  it('renders nothing when no session', () => {
    const { container } = renderWith(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing on auth routes', () => {
    const { container } = renderWith(
      {
        userId: 'u1',
        roles: ['Admin'],
        name: 'Alice Example',
        email: 'alice@example.com',
        photoUrl: null,
      },
      '/auth/signin'
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the trigger with initials fallback', () => {
    renderWith({
      userId: 'u1',
      roles: ['Approver'],
      name: 'Alice Example',
      email: 'alice@example.com',
      photoUrl: null,
    })
    const trigger = screen.getByRole('button', { name: /open user menu/i })
    expect(trigger).toBeDefined()
    expect(trigger.textContent).toContain('AE')
  })

  it('opens the dropdown with name, email, role badge and sign-out form', async () => {
    const user = userEvent.setup()
    renderWith({
      userId: 'u1',
      roles: ['Admin'],
      name: 'Alice Example',
      email: 'alice@example.com',
      photoUrl: null,
    })

    await user.click(screen.getByRole('button', { name: /open user menu/i }))

    expect(screen.getByText('Alice Example')).toBeDefined()
    expect(screen.getByText('alice@example.com')).toBeDefined()
    expect(screen.getByLabelText('Role: Admin')).toBeDefined()

    const signOutItem = screen.getByText('Sign out')
    const form = signOutItem.closest('form')
    expect(form).not.toBeNull()
    expect(form?.getAttribute('action')).toBe('/auth/signout')
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post')
  })

  it('theme item toggles dark class without closing the menu', async () => {
    const user = userEvent.setup()
    document.documentElement.classList.remove('dark')
    renderWith({
      userId: 'u1',
      roles: ['Requester'],
      name: 'Bob',
      email: null,
      photoUrl: null,
    })

    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    const themeItem = screen.getByTestId('user-menu-theme')

    await user.click(themeItem)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    // Menu stays open: the theme item is still in the DOM.
    expect(screen.getByTestId('user-menu-theme')).toBeDefined()
  })

  it('prefers Admin when multiple roles are present', async () => {
    const user = userEvent.setup()
    renderWith({
      userId: 'u1',
      roles: ['Requester', 'Admin'],
      name: 'Alice',
      email: null,
      photoUrl: null,
    })
    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByLabelText('Role: Admin')).toBeDefined()
  })
})
