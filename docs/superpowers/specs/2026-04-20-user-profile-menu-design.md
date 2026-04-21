# User Profile Menu & Sign-Out — Design

**Status:** Approved
**Date:** 2026-04-20
**Owner:** Mike Charo

## Goal

Now that Entra ID authentication is wired end-to-end, every page should show who is signed in and offer a one-click sign-out. The result should feel like a single cohesive app, matching patterns users expect from Linear, Vercel, and GitHub: an avatar in the top-right opens a dropdown containing identity, theme control, and sign-out.

## Non-goals

- Profile editing UI (no `/profile` route in this scope).
- Password / MFA management (delegated to Entra ID).
- Admin user management.
- Any change to the middleware, JWE session format, or sign-in flow.

## User-facing behavior

- **Top-right avatar**, fixed position, visible on every authenticated page.
- Clicking the avatar opens a dropdown:
  1. Header: avatar + name + email + role badge.
  2. Theme toggle menu item (stays open on select so the user can see the change).
  3. Sign out menu item (destructive style).
- Hidden entirely on `/auth/*` routes and when no session is present.
- Theme toggle moves from its current home-page button into this dropdown; the standalone button is removed.

## Architecture

### Session provider promotion

`SessionProvider` currently wraps only `(protected)/layout.tsx`, so routes like `/chat` and `/agent-teams` cannot use `useSession()`. Middleware already enforces authentication on every non-`/auth/*` route, so promoting the provider to the root is safe and unlocks a single top-right menu component for all pages.

Change:

- `src/app/layout.tsx` (server) calls `getSessionForClient()` and renders `<SessionProvider session={session}>`.
- `src/app/(protected)/layout.tsx` is simplified — it no longer needs to mount the provider. It keeps its `redirect('/auth/signin')` guard in case the session is missing at render time.

### New `useSession()` hook

Add to `src/components/auth/session-provider.tsx`:

```ts
export function useSession(): ClientSession | null {
  const ctx = useContext(SessionContext)
  return ctx ?? null
}
```

Safe to call anywhere inside the root tree; returns `null` when there is no session.

### `<UserMenu />` component

New client component at `src/components/auth/UserMenu.tsx`.

- Rendered in `app/layout.tsx`, positioned `fixed right-3 top-3 z-50`.
- Reads `useSession()` and `usePathname()`; returns `null` if session is null or pathname starts with `/auth/`.
- Uses shadcn `DropdownMenu`, `Avatar`, `Button`, `Separator`.
- Trigger: `Button variant="ghost"` wrapping an `Avatar` sized `h-9 w-9`, with `aria-label="Open user menu"` and a visible focus ring.
- `AvatarImage` `src={photoUrl ?? undefined}`; Radix auto-falls back to `AvatarFallback` (initials).
- Dropdown `align="end"`, `w-64`, with these sections:
  1. **Header** — avatar + name (medium weight) + email (muted, truncated) + role badge.
  2. `DropdownMenuSeparator`.
  3. **Theme item** — Sun / Moon icon plus label (`"Light mode"` / `"Dark mode"`), `onSelect={(e) => e.preventDefault()}` to keep the menu open, calls `toggleTheme()` from `useTheme()`.
  4. `DropdownMenuSeparator`.
  5. **Sign out item** — destructive styling, `LogOut` icon, wraps a `<form method="POST" action="/auth/signout">` via `DropdownMenuItem asChild`. Uses the existing sign-out route; works without JS.

### Role badge

Implemented as a small `<span>` with role-based Tailwind classes, co-located inside `UserMenu.tsx` (used nowhere else — no need for a shared shadcn `Badge` component):

| Role        | Classes                                              |
| ----------- | ---------------------------------------------------- |
| `Admin`     | `bg-primary text-primary-foreground`                 |
| `Approver`  | `bg-secondary text-secondary-foreground`             |
| `Requester` | `bg-muted text-muted-foreground`                     |

Shared classes: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide`. Badge text equals the role name. Gets `aria-label="Role: <role>"`.

### Initials fallback

Helper (co-located) computes initials as follows:

1. If `name` has two or more whitespace-separated tokens → first letter of the first and last token, uppercased.
2. Else if `name` has one token → first two characters of that token, uppercased.
3. Else if `email` is present → first two characters of the local part, uppercased.
4. Else → `"?"`.

### Theme toggle consolidation

- Delete the button instance of `ThemeToggle` from any page that currently renders it.
- The `ThemeToggle` component itself can remain exported for possible future reuse, but it is no longer mounted in the tree.

### GlobalNav

No structural change. It already returns `null` on `/auth/*`. The new `UserMenu` is a sibling in the root layout, so the centered nav pill and the top-right avatar cluster coexist without overlap (`UserMenu` is at `right-3`, the pill is at `left-1/2 -translate-x-1/2`).

## shadcn/ui initialization

Project does not yet have `components.json` or `src/components/ui/`.

1. Run `npx shadcn@latest init` with: TypeScript yes, style `default`, base color `slate` (matches existing theme), CSS variables yes, `cn` util at `@/lib/utils` (already exists), components at `@/components`, utils at `@/lib/utils`, React Server Components yes.
2. Add components one at a time, confirming after each: `npx shadcn@latest add avatar`, then `dropdown-menu`, `button`, `separator`.
3. After each component: open the generated file, confirm it imports Radix primitives already in `package.json` (no new runtime deps expected), run `npm run lint` and `npm run build` to catch regressions.
4. Add `@radix-ui/react-avatar` already exists at `^1.0.4` — verify the shadcn-generated code is compatible with that version; bump if needed.

## Data flow

1. Request hits middleware → JWE validated → session payload forwarded via `SESSION_HEADER`.
2. Root `app/layout.tsx` (server) calls `getSessionForClient()` → hands the result to `<SessionProvider>`.
3. `<UserMenu />` (client) reads the session through `useSession()`.
4. Sign-out: the form posts to `/auth/signout` (existing route) → cookie cleared → redirect to `/auth/signin`.

## Error handling

- **Avatar image load failure** — Radix falls back automatically to `AvatarFallback` (initials).
- **Null name** — initials computed from email; the name row is hidden if `name` is null.
- **Null email** — email row hidden.
- **Unknown role** — treated as `Requester` (consistent with `src/lib/auth/roles.ts` default).
- **Session unavailable** — component renders `null` rather than throwing; this should never occur in practice because of middleware, but it is a defensive guard.
- **Sign-out failure** — the route only clears a cookie and redirects; no meaningful failure path. If the request errors, the browser surfaces it natively (no custom error UI needed for this boilerplate).

## Accessibility

- Trigger is a real `button` with `aria-label="Open user menu"` and visible focus ring.
- Role badge carries `aria-label="Role: <role>"`.
- Dropdown uses Radix primitives (keyboard navigation, ESC, click-outside, focus trapping, and return-focus all handled).
- Email text uses `truncate` with `title={email}` so screen readers and hover tooltips expose the full value.
- Destructive sign-out item uses `role="menuitem"` (Radix default) with a `LogOut` icon marked `aria-hidden`.

## Responsive behavior

- Avatar stays `h-9 w-9` on all breakpoints.
- Dropdown content is `w-64` with `align="end"`; Radix collision detection re-aligns on narrow viewports.
- Top-right placement (`right-3 top-3`) stays clear of the centered nav pill on mobile because the nav pill hides its labels at `< sm` breakpoints and stays near the center.

## Testing

### Unit tests — `__tests__/unit/components/auth/UserMenu.test.tsx`

- renders avatar image when `photoUrl` is a URL
- renders initials fallback when `photoUrl` is null
- renders `"?"` fallback when name and email are both null
- opens dropdown on trigger click; shows name, email, role badge
- role badge variant matches the active role (`Admin` / `Approver` / `Requester`)
- theme menu item calls `toggleTheme()` and does not close the menu
- sign-out item is inside a `form[action="/auth/signout"][method="POST"]`
- returns `null` when `useSession()` is `null`
- returns `null` when pathname starts with `/auth/`

### E2E tests — `__tests__/e2e/user-menu.spec.ts`

Uses the existing `__tests__/helpers/mockSession.ts` pre-baked JWE cookie helper.

- avatar visible on `/`, `/chat`, `/approvals`, `/agent-teams`
- dropdown opens and shows name + email + role badge
- clicking sign-out navigates to `/auth/signin` and clears `SESSION_COOKIE`
- theme toggle changes the `<html>` `class` (dark ↔ light) without closing the menu

No new Entra mocks required — existing MSW handlers and session helpers cover the surface.

## File-by-file change list

- **Modify** `src/app/layout.tsx` — fetch session, mount `<SessionProvider>` and `<UserMenu />`.
- **Modify** `src/app/(protected)/layout.tsx` — drop `<SessionProvider>` wrapper (keep redirect guard).
- **Modify** `src/components/auth/session-provider.tsx` — add `useSession()` hook.
- **Create** `src/components/auth/UserMenu.tsx`.
- **Create** shadcn scaffolding: `components.json`, `src/components/ui/avatar.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/button.tsx`, `src/components/ui/separator.tsx`.
- **Modify** `src/app/page.tsx` (and any other page that renders `<ThemeToggle />`) to remove the standalone theme button.
- **Create** `__tests__/unit/components/auth/UserMenu.test.tsx`.
- **Create** `__tests__/e2e/user-menu.spec.ts`.

## Out of scope / follow-ups

- Keyboard shortcut for opening the menu (e.g., `⌘K`-style) — can be added later if users ask.
- Profile edit page — intentionally deferred; not requested.
- Server-driven role refresh without re-login — the sliding refresh in `getActor()` already handles session extension; role changes still require sign-out and back in.
