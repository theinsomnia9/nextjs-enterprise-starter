import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../../../setup/test-utils'
import UserMenu from '@/components/auth/UserMenu'
import { SessionProvider } from '@/components/auth/session-provider'

// Radix AvatarImage returns null in jsdom because images never fire onLoad.
// Mock the primitive so AvatarImage always renders an <img> with the given src.
vi.mock('@radix-ui/react-avatar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@radix-ui/react-avatar')>()
  return {
    ...actual,
    Image: vi.fn(({ src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) =>
      // eslint-disable-next-line @next/next/no-img-element
      src ? <img src={src} alt="" {...props} /> : null
    ),
  }
})

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

  it('opens the dropdown with name, email, role badge and sign-out link', async () => {
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

    const signOutItem = screen.getByTestId('user-menu-signout')
    expect(signOutItem.tagName).toBe('A')
    expect(signOutItem.getAttribute('href')).toBe('/auth/signout')
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

  it('renders avatar image when photoUrl is a URL', async () => {
    const user = userEvent.setup()
    const photoUrl = 'https://example.com/photo.jpg'
    renderWith({
      userId: 'u1',
      roles: ['Requester'],
      name: 'Carol Test',
      email: 'carol@example.com',
      photoUrl,
    })

    // Open the menu so the header avatar is rendered
    await user.click(screen.getByRole('button', { name: /open user menu/i }))

    // Radix AvatarImage renders <img> elements in the DOM with the given src.
    // In jsdom images never fire onLoad, so they remain hidden from ARIA queries
    // but are still present in the DOM — query from document.body because the
    // dropdown content is rendered in a Radix portal outside `container`.
    const imgs = document.body.querySelectorAll(`img[src="${photoUrl}"]`)
    expect(imgs.length).toBeGreaterThan(0)
  })

  it('renders "?" when name and email are both null', () => {
    renderWith({
      userId: 'u1',
      roles: ['Requester'],
      name: null,
      email: null,
      photoUrl: null,
    })
    // The trigger button fallback should show "?"
    const trigger = screen.getByRole('button', { name: /open user menu/i })
    expect(trigger.textContent).toContain('?')
  })

  it('renders correct badge classes for Admin role', async () => {
    const user = userEvent.setup()
    renderWith({
      userId: 'u1',
      roles: ['Admin'],
      name: 'Ada Admin',
      email: 'ada@example.com',
      photoUrl: null,
    })
    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    const badge = screen.getByLabelText('Role: Admin')
    expect(badge.classList.contains('bg-primary')).toBe(true)
    expect(badge.classList.contains('text-primary-foreground')).toBe(true)
  })

  it('renders correct badge classes for Approver role', async () => {
    const user = userEvent.setup()
    renderWith({
      userId: 'u1',
      roles: ['Approver'],
      name: 'April Approver',
      email: 'april@example.com',
      photoUrl: null,
    })
    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    const badge = screen.getByLabelText('Role: Approver')
    expect(badge.classList.contains('bg-secondary')).toBe(true)
    expect(badge.classList.contains('text-secondary-foreground')).toBe(true)
  })

  it('renders correct badge classes for Requester role', async () => {
    const user = userEvent.setup()
    renderWith({
      userId: 'u1',
      roles: ['Requester'],
      name: 'Rex Requester',
      email: 'rex@example.com',
      photoUrl: null,
    })
    await user.click(screen.getByRole('button', { name: /open user menu/i }))
    const badge = screen.getByLabelText('Role: Requester')
    expect(badge.classList.contains('bg-muted')).toBe(true)
    expect(badge.classList.contains('text-muted-foreground')).toBe(true)
  })

  it('sign out item is a link to /auth/signout', async () => {
    const user = userEvent.setup()
    renderWith({
      userId: 'u1',
      roles: ['Approver'],
      name: 'Alice Example',
      email: 'alice@example.com',
      photoUrl: null,
    })

    await user.click(screen.getByRole('button', { name: /open user menu/i }))

    const signOutItem = screen.getByTestId('user-menu-signout')
    expect(signOutItem.tagName).toBe('A')
    expect(signOutItem.getAttribute('href')).toBe('/auth/signout')
  })
})
