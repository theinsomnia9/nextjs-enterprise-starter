# User Profile Menu & Sign-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-right avatar dropdown on every authenticated page that shows identity + role and provides a one-click sign-out, using shadcn/ui components.

**Architecture:** Promote `SessionProvider` to the root layout so a single `<UserMenu />` client component in `app/layout.tsx` serves every page. Session data comes from `getSessionForClient()` (server) → context → `useSession()` (client). Sign-out uses a plain POST form to the existing `/auth/signout` route (no JS required). Theme toggle moves inside the dropdown so the top-right is a single avatar.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui (new), Radix primitives (avatar, dropdown-menu, slot — all already in `package.json`), lucide-react icons, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-20-user-profile-menu-design.md`

---

## File Structure

**Create:**
- `components.json` — shadcn config at repo root
- `src/components/ui/button.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/separator.tsx`
- `src/components/auth/UserMenu.tsx`
- `src/components/auth/userMenuHelpers.ts` — pure helpers (initials, role styling) for testability
- `__tests__/unit/components/auth/userMenuHelpers.test.ts`
- `__tests__/unit/components/auth/UserMenu.test.tsx`
- `__tests__/unit/components/auth/useSession.test.tsx`
- `__tests__/e2e/user-menu.spec.ts`

**Modify:**
- `src/components/auth/session-provider.tsx` — export `useSession()` hook
- `src/app/layout.tsx` — fetch session, mount `<SessionProvider>` + `<UserMenu />`
- `src/app/(protected)/layout.tsx` — drop duplicate `<SessionProvider>` wrapper
- `src/app/page.tsx` — remove inline `<ThemeToggle />` block
- `src/app/builder/page.tsx` — remove inline `<ThemeToggle />` block

---

## Task 1: Add shadcn/ui config (`components.json`)

**Files:**
- Create: `components.json`

- [ ] **Step 1: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 2: Verify lint still passes**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components.json
git commit -m "chore(ui): add shadcn config"
```

---

## Task 2: Add shadcn `Button` primitive

**Files:**
- Create: `src/components/ui/button.tsx`
- Test: `__tests__/unit/components/ui/button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/ui/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders a button element by default', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined()
  })

  it('renders as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>
    )
    const el = screen.getByRole('link', { name: 'Link' })
    expect(el.tagName).toBe('A')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button', { name: 'Ghost' })
    expect(btn.className).toMatch(/hover:bg-accent/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/components/ui/button.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/button'`.

- [ ] **Step 3: Create the Button component**

Create `src/components/ui/button.tsx`:

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/components/ui/button.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx __tests__/unit/components/ui/button.test.tsx
git commit -m "feat(ui): add shadcn Button primitive"
```

---

## Task 3: Add shadcn `Avatar` primitive

**Files:**
- Create: `src/components/ui/avatar.tsx`
- Test: `__tests__/unit/components/ui/avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/ui/avatar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

describe('Avatar', () => {
  it('renders fallback text when no image provided', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText('AB')).toBeDefined()
  })

  it('renders fallback while image would load', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/a.png" alt="" />
        <AvatarFallback>CD</AvatarFallback>
      </Avatar>
    )
    // Radix keeps fallback in the tree until the image finishes loading;
    // in jsdom the image never loads, so the fallback stays visible.
    expect(screen.getByText('CD')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/components/ui/avatar.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/avatar'`.

- [ ] **Step 3: Create the Avatar component**

Create `src/components/ui/avatar.tsx`:

```tsx
'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'

import { cn } from '@/lib/utils'

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/components/ui/avatar.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/avatar.tsx __tests__/unit/components/ui/avatar.test.tsx
git commit -m "feat(ui): add shadcn Avatar primitive"
```

---

## Task 4: Add shadcn `DropdownMenu` primitive

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`
- Test: `__tests__/unit/components/ui/dropdown-menu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/ui/dropdown-menu.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../../../setup/test-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu', () => {
  it('opens when the trigger is clicked and shows items', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
          <DropdownMenuItem>Two</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open'))

    expect(screen.getByText('One')).toBeDefined()
    expect(screen.getByText('Two')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/components/ui/dropdown-menu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the DropdownMenu component**

Create `src/components/ui/dropdown-menu.tsx`:

```tsx
'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName =
  DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/components/ui/dropdown-menu.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx __tests__/unit/components/ui/dropdown-menu.test.tsx
git commit -m "feat(ui): add shadcn DropdownMenu primitive"
```

---

## Task 5: Add shadcn `Separator` primitive

**Files:**
- Create: `src/components/ui/separator.tsx`
- Test: `__tests__/unit/components/ui/separator.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/ui/separator.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '../../../setup/test-utils'
import { Separator } from '@/components/ui/separator'

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(<Separator />)
    const el = container.querySelector('[role="none"], [data-orientation]')
    expect(el).toBeTruthy()
    expect(el?.getAttribute('data-orientation')).toBe('horizontal')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/components/ui/separator.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the Separator component**

Create `src/components/ui/separator.tsx`:

```tsx
'use client'

import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'

import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/components/ui/separator.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/separator.tsx __tests__/unit/components/ui/separator.test.tsx
git commit -m "feat(ui): add shadcn Separator primitive"
```

---

## Task 6: Add `useSession()` hook to SessionProvider

**Files:**
- Modify: `src/components/auth/session-provider.tsx`
- Test: `__tests__/unit/components/auth/useSession.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/auth/useSession.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/components/auth/useSession.test.tsx`
Expected: FAIL — `useSession is not exported from @/components/auth/session-provider`.

- [ ] **Step 3: Update the SessionProvider to export `useSession`**

Replace the full contents of `src/components/auth/session-provider.tsx` with:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/components/auth/useSession.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/session-provider.tsx __tests__/unit/components/auth/useSession.test.tsx
git commit -m "feat(auth): add useSession hook"
```

---

## Task 7: Promote `SessionProvider` to root layout

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/(protected)/layout.tsx`

- [ ] **Step 1: Update `src/app/layout.tsx`**

Replace the full contents of `src/app/layout.tsx` with:

```tsx
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
```

- [ ] **Step 2: Simplify `src/app/(protected)/layout.tsx`**

Replace with:

```tsx
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
```

- [ ] **Step 3: Verify build + unit tests still pass**

Run: `npm run build`
Expected: succeeds.

Run: `npm run test:unit`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/\(protected\)/layout.tsx
git commit -m "refactor(auth): promote SessionProvider to root layout"
```

---

## Task 8: Add `UserMenu` helpers (initials + role styling)

**Files:**
- Create: `src/components/auth/userMenuHelpers.ts`
- Test: `__tests__/unit/components/auth/userMenuHelpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/auth/userMenuHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  initialsFor,
  roleBadgeClasses,
} from '@/components/auth/userMenuHelpers'

describe('initialsFor', () => {
  it('returns first and last initials for a multi-word name', () => {
    expect(initialsFor({ name: 'Alice Example', email: null })).toBe('AE')
  })

  it('returns first and last initials even with extra whitespace', () => {
    expect(initialsFor({ name: '  Alice   Middle Example  ', email: null })).toBe(
      'AE'
    )
  })

  it('returns first two chars for a single-token name', () => {
    expect(initialsFor({ name: 'Alice', email: null })).toBe('AL')
  })

  it('falls back to email local part when name is null', () => {
    expect(initialsFor({ name: null, email: 'alice@example.com' })).toBe('AL')
  })

  it('returns "?" when name and email are both null', () => {
    expect(initialsFor({ name: null, email: null })).toBe('?')
  })

  it('returns "?" when name is only whitespace and no email', () => {
    expect(initialsFor({ name: '   ', email: null })).toBe('?')
  })
})

describe('roleBadgeClasses', () => {
  it('returns primary classes for Admin', () => {
    expect(roleBadgeClasses('Admin')).toMatch(/bg-primary/)
  })

  it('returns secondary classes for Approver', () => {
    expect(roleBadgeClasses('Approver')).toMatch(/bg-secondary/)
  })

  it('returns muted classes for Requester', () => {
    expect(roleBadgeClasses('Requester')).toMatch(/bg-muted/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/components/auth/userMenuHelpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the helpers file**

Create `src/components/auth/userMenuHelpers.ts`:

```ts
import type { Role } from '@/lib/auth/roles'

export function initialsFor({
  name,
  email,
}: {
  name: string | null
  email: string | null
}): string {
  const trimmedName = name?.trim() ?? ''
  if (trimmedName.length > 0) {
    const tokens = trimmedName.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      const first = tokens[0]!.charAt(0)
      const last = tokens[tokens.length - 1]!.charAt(0)
      return (first + last).toUpperCase()
    }
    return tokens[0]!.slice(0, 2).toUpperCase()
  }

  const local = email?.split('@')[0]?.trim() ?? ''
  if (local.length > 0) {
    return local.slice(0, 2).toUpperCase()
  }
  return '?'
}

const BADGE_BASE =
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide'

export function roleBadgeClasses(role: Role): string {
  switch (role) {
    case 'Admin':
      return `${BADGE_BASE} bg-primary text-primary-foreground`
    case 'Approver':
      return `${BADGE_BASE} bg-secondary text-secondary-foreground`
    default:
      return `${BADGE_BASE} bg-muted text-muted-foreground`
  }
}

export function primaryRole(roles: readonly Role[]): Role {
  if (roles.includes('Admin')) return 'Admin'
  if (roles.includes('Approver')) return 'Approver'
  return 'Requester'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/components/auth/userMenuHelpers.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/userMenuHelpers.ts __tests__/unit/components/auth/userMenuHelpers.test.ts
git commit -m "feat(auth): add UserMenu helpers"
```

---

## Task 9: Build the `UserMenu` component

**Files:**
- Create: `src/components/auth/UserMenu.tsx`
- Test: `__tests__/unit/components/auth/UserMenu.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/components/auth/UserMenu.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/unit/components/auth/UserMenu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the UserMenu component**

Create `src/components/auth/UserMenu.tsx`:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Moon, Sun } from 'lucide-react'

import { useSession } from '@/components/auth/session-provider'
import { useTheme } from '@/providers/ThemeProvider'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  initialsFor,
  primaryRole,
  roleBadgeClasses,
} from '@/components/auth/userMenuHelpers'

export default function UserMenu() {
  const session = useSession()
  const pathname = usePathname() ?? '/'
  const { theme, toggleTheme } = useTheme()

  if (!session) return null
  if (pathname.startsWith('/auth/')) return null

  const role = primaryRole(session.roles)
  const initials = initialsFor({ name: session.name, email: session.email })
  const displayName = session.name?.trim() || session.email || 'Account'

  return (
    <div className="fixed right-3 top-3 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open user menu"
            className="h-9 w-9 rounded-full border border-border bg-card/80 p-0 shadow-sm backdrop-blur hover:bg-accent"
          >
            <Avatar className="h-9 w-9">
              {session.photoUrl ? (
                <AvatarImage src={session.photoUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-64">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              {session.photoUrl ? (
                <AvatarImage src={session.photoUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {session.name ? (
                <div className="truncate text-sm font-medium" title={session.name}>
                  {session.name}
                </div>
              ) : null}
              {session.email ? (
                <div
                  className="truncate text-xs text-muted-foreground"
                  title={session.email}
                >
                  {session.email}
                </div>
              ) : null}
              <div className="mt-1">
                <span
                  className={roleBadgeClasses(role)}
                  aria-label={`Role: ${role}`}
                >
                  {role}
                </span>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="user-menu-theme"
            onSelect={(e) => {
              e.preventDefault()
              toggleTheme()
            }}
            className="gap-2"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form method="POST" action="/auth/signout">
            <DropdownMenuItem asChild>
              <button
                type="submit"
                data-testid="user-menu-signout"
                className="flex w-full cursor-default items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sign out</span>
                <span className="sr-only">, {displayName}</span>
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/unit/components/auth/UserMenu.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/UserMenu.tsx __tests__/unit/components/auth/UserMenu.test.tsx
git commit -m "feat(auth): add UserMenu dropdown with sign-out"
```

---

## Task 10: Mount `UserMenu` in the root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Edit `src/app/layout.tsx` to mount `<UserMenu />`**

Replace the full contents of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClientProviders } from '@/components/ClientProviders'
import GlobalNav from '@/components/nav/GlobalNav'
import { SessionProvider } from '@/components/auth/session-provider'
import UserMenu from '@/components/auth/UserMenu'
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
            <UserMenu />
            {children}
          </SessionProvider>
        </ClientProviders>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(auth): mount UserMenu in root layout"
```

---

## Task 11: Remove standalone `ThemeToggle` instances

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/builder/page.tsx`

- [ ] **Step 1: Edit `src/app/page.tsx`**

Replace the full contents with:

```tsx
import Link from 'next/link'

const NAV_ROUTES = [
  {
    id: 'agent-teams',
    href: '/agent-teams',
    label: 'Agent Team Builder',
    description:
      'Design multi-agent workflows on a canvas, refine with structured forms, and iterate with a chat-driven AI designer.',
    badge: 'LangGraph',
  },
  {
    id: 'chat',
    href: '/chat',
    label: 'Chat',
    description:
      'Talk to a tool-using agent with streaming responses and persisted history.',
    badge: 'SSE',
  },
  {
    id: 'approvals',
    href: '/approvals',
    label: 'Approval Queue',
    description:
      'Review, lock, and action queued requests with real-time updates.',
    badge: 'Realtime',
  },
]

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      <div className="w-full max-w-5xl">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Workspace</h1>
          <p className="text-lg text-muted-foreground">
            Jump into a tool. Each card opens a standalone feature.
          </p>
        </div>
        <nav aria-label="Primary">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_ROUTES.map((route) => (
              <li key={route.id} data-testid={`nav-card-${route.id}`}>
                <Link
                  href={route.href}
                  aria-label={`${route.label} — ${route.description}`}
                  className="focus-ring group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold group-hover:text-primary">
                      {route.label}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {route.badge}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {route.description}
                  </p>
                  <span className="mt-auto text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Edit `src/app/builder/page.tsx`**

Replace the full contents with:

```tsx
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder'

export default function BuilderPage() {
  return (
    <main className="h-screen w-full">
      <WorkflowBuilder />
    </main>
  )
}
```

- [ ] **Step 3: Update the existing home E2E test if it asserts on the toggle**

Run: `npx vitest run __tests__/unit/components/theme/ThemeToggle.test.tsx`
Expected: PASS — the component is still exported and tested in isolation.

Also check: `grep -n "theme-toggle\|toggle theme" __tests__/e2e/theme.spec.ts` — if the spec relies on a button being on the home page, update it to open the user menu first and click the theme item (use `[data-testid="user-menu-theme"]`). This is handled in Task 12.

- [ ] **Step 4: Verify unit tests pass**

Run: `npm run test:unit`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/builder/page.tsx
git commit -m "refactor(ui): move theme toggle into UserMenu"
```

---

## Task 12: E2E tests for `UserMenu` and fix theme E2E

**Files:**
- Create: `__tests__/e2e/user-menu.spec.ts`
- Modify: `__tests__/e2e/theme.spec.ts` (if it references a standalone theme button on the home page)

- [ ] **Step 1: Read the existing theme E2E to see if it needs updating**

Run: `grep -n "toggle theme\|ThemeToggle\|data-icon" __tests__/e2e/theme.spec.ts`

If any line selects the toggle on the home page directly, update the selector to:

```ts
await page.getByRole('button', { name: /open user menu/i }).click()
await page.getByTestId('user-menu-theme').click()
```

Keep the assertions about the `<html>` `dark` class and `localStorage` unchanged.

- [ ] **Step 2: Create `__tests__/e2e/user-menu.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { buildSessionCookie } from '../helpers/mockSession'

const BASE = 'http://localhost:3000'

async function signIn(
  context: import('@playwright/test').BrowserContext,
  overrides: Parameters<typeof buildSessionCookie>[0] = {
    userId: 'dev-user-alice',
    roles: ['Approver'],
    name: 'Alice Example',
    email: 'alice@example.com',
  }
) {
  const cookie = await buildSessionCookie(overrides)
  await context.addCookies([
    {
      name: 'session',
      value: encodeURIComponent(cookie),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

test.describe('UserMenu', () => {
  test('avatar is visible on protected pages', async ({ context, page }) => {
    await signIn(context)

    for (const path of ['/', '/chat', '/agent-teams', '/approvals']) {
      await page.goto(`${BASE}${path}`)
      await expect(
        page.getByRole('button', { name: /open user menu/i })
      ).toBeVisible()
    }
  })

  test('dropdown shows name, email, role', async ({ context, page }) => {
    await signIn(context, {
      userId: 'dev-user-alice',
      roles: ['Admin'],
      name: 'Alice Example',
      email: 'alice@example.com',
    })
    await page.goto(`${BASE}/`)

    await page.getByRole('button', { name: /open user menu/i }).click()
    await expect(page.getByText('Alice Example')).toBeVisible()
    await expect(page.getByText('alice@example.com')).toBeVisible()
    await expect(page.getByLabel('Role: Admin')).toBeVisible()
  })

  test('sign-out clears session and redirects to signin', async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(`${BASE}/`)

    await page.getByRole('button', { name: /open user menu/i }).click()
    await page.getByTestId('user-menu-signout').click()

    await page.waitForURL((url) => {
      const s = url.toString()
      return s.includes('login.microsoftonline.com') || s.includes('/auth/signin')
    })
    const finalUrl = page.url()
    expect(
      finalUrl.includes('login.microsoftonline.com') ||
        finalUrl.includes('/auth/signin')
    ).toBe(true)

    const cookies = await context.cookies()
    const session = cookies.find((c) => c.name === 'session')
    expect(session?.value ?? '').toBe('')
  })

  test('theme menu item toggles dark mode without closing the menu', async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(`${BASE}/`)

    await page.getByRole('button', { name: /open user menu/i }).click()

    const htmlEl = page.locator('html')
    const before = await htmlEl.getAttribute('class')

    await page.getByTestId('user-menu-theme').click()

    // Menu stays open — item is still visible.
    await expect(page.getByTestId('user-menu-theme')).toBeVisible()

    const after = await htmlEl.getAttribute('class')
    expect(after).not.toBe(before)
  })

  test('menu is hidden on /auth routes', async ({ page }) => {
    await page.goto(`${BASE}/auth/unauthorized`)
    await expect(
      page.getByRole('button', { name: /open user menu/i })
    ).toHaveCount(0)
  })
})
```

- [ ] **Step 3: Run E2E tests**

Ensure the dev DB and app are available, then:

Run: `npm run test:e2e -- user-menu.spec.ts`
Expected: all 5 tests pass.

Run: `npm run test:e2e -- theme.spec.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/e2e/user-menu.spec.ts __tests__/e2e/theme.spec.ts
git commit -m "test(e2e): cover UserMenu and fix theme selectors"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite with coverage**

Run: `npm run test:unit`
Expected: all suites pass, coverage threshold (80%) still met.

- [ ] **Step 2: Run lint and build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Manual smoke test in a browser**

Run: `npm run dev` in one terminal.

In another, load `http://localhost:3000/` with a valid dev session cookie (either sign in through Entra or set the cookie via the test helper). Verify:

1. Avatar is visible top-right.
2. Clicking opens the dropdown with correct name / email / role badge.
3. Clicking the theme item toggles dark mode and the menu stays open.
4. Clicking "Sign out" redirects to `/auth/signin` and clears the cookie.
5. Visit `/auth/signin` directly (clear cookie first) — no avatar visible.

- [ ] **Step 4: Final commit marker**

If any small touch-ups were made during smoke test, commit them:

```bash
git add -A
git commit -m "chore(auth): UserMenu smoke-test polish" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage:** every requirement in the design doc maps to a task: shadcn setup (Tasks 1–5), session promotion + hook (Tasks 6–7), UserMenu with header/theme/sign-out (Tasks 8–9), mount (Task 10), theme-toggle cleanup (Task 11), tests (Task 12), verification (Task 13).
- **Placeholder scan:** every code block is complete; no TBDs, no "implement later".
- **Type consistency:** `ClientSession`, `Role`, `initialsFor`, `primaryRole`, `roleBadgeClasses` names are stable across tasks.
- **Tests before implementation:** every implementation task is preceded by a failing test step.
- **Commits:** every task ends with a focused commit.
