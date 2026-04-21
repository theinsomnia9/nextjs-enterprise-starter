# Boilerplate Gut-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip all demo features (approvals, chat, agent-teams, workflow builder) from this repo and leave a minimal enterprise-ready Next.js 16 boilerplate: public landing + protected dashboard + settings (with admin-only sub-page). Keep Entra auth, OpenTelemetry, Prisma, errors, Docker stack, and the TDD harness intact.

**Architecture:** Work in the existing worktree at `~/Documents/Github/nextjs-boiler-plate-boilerplate-cleanup` on branch `boilerplate-cleanup`. Delete demo domains in one pass (code + tests + deps + docs per domain), then collapse the Prisma schema, rename roles to `Admin`/`User`, scaffold the three new pages TDD-style, and rewrite the docs. Final verification runs lint, tests, build, and a grep sweep for residual references.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` — the Next 16 rename of middleware), React 19, TypeScript (strict), Prisma 5 + Postgres, MSAL Node + `jose` (JWE sessions), OpenTelemetry, Vitest + Playwright + MSW, Tailwind + Radix primitives.

---

## Working directory

All commands assume CWD = `/Users/mike/Documents/Github/nextjs-boiler-plate-boilerplate-cleanup` (the worktree). The spec lives at `docs/superpowers/specs/2026-04-20-boilerplate-gutout-design.md`.

## Decisions deferred to execution

If a judgment call comes up that the user should review later, append it to `NOTES-FOR-REVIEW.md` at the worktree root (create on first write). Don't block on user input.

---

## Phase 1 — Delete demo domains

Each task deletes one domain's route pages, API routes, components, lib modules, services, tests, and E2E specs in one commit. After each commit, the tree should still compile at the TypeScript level (demos only reference each other or their own infra).

### Task 1: Delete the approvals demo

**Files:** delete the following (directories and files)
- Delete: `src/app/(protected)/approvals/`
- Delete: `src/app/api/approvals/`
- Delete: `src/app/api/cron/` (cron was approvals SLA escalation)
- Delete: `src/app/api/sse/` (approvals-specific SSE route)
- Delete: `src/components/approval/`
- Delete: `src/lib/approvals/`
- Delete: `src/services/approvalService.ts`
- Delete: `__tests__/unit/lib/approvals/`
- Delete: `__tests__/unit/components/approval/`
- Delete: `__tests__/unit/app/approvals/` (if present)
- Delete: `__tests__/unit/app/api/` entries for approvals
- Delete: `__tests__/unit/services/approvalService.*.test.ts`
- Delete: `__tests__/integration/actions/approvals.test.ts`
- Delete: `__tests__/e2e/approvals-flow.spec.ts`
- Delete: `__tests__/e2e/approvals-sse.spec.ts`

- [ ] **Step 1: Delete the directories and files**

```bash
git rm -r src/app/\(protected\)/approvals src/app/api/approvals src/app/api/cron src/app/api/sse
git rm -r src/components/approval src/lib/approvals src/services/approvalService.ts
git rm -r __tests__/unit/lib/approvals __tests__/unit/components/approval
git rm -rf __tests__/unit/app/approvals __tests__/unit/app/api
git rm __tests__/unit/services/approvalService.*.test.ts
git rm __tests__/integration/actions/approvals.test.ts
git rm __tests__/e2e/approvals-flow.spec.ts __tests__/e2e/approvals-sse.spec.ts
```

- [ ] **Step 2: Check for residual imports**

```bash
grep -rn "from.*approvals\|from.*approvalService\|from.*@/services/approvalService" src __tests__ || echo OK
```

Expected: prints `OK`. If anything remains, open the offender — it's almost certainly a demo file that belongs to a later task; note it and move on.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete approvals demo (routes, api, components, lib, services, tests)"
```

---

### Task 2: Delete the chat demo

**Files:**
- Delete: `src/app/chat/`
- Delete: `src/app/api/chat/`
- Delete: `src/components/chat/`
- Delete: `src/lib/chat/`
- Delete: `src/lib/agent/` (LangGraph agent module — only chat uses it)
- Delete: `__tests__/unit/lib/chat/` (if present)
- Delete: `__tests__/unit/lib/agent/`
- Delete: `__tests__/unit/components/chat/`
- Delete: `__tests__/unit/app/chat/`
- Delete: `__tests__/e2e/chat.spec.ts`
- Delete: `__tests__/e2e/chat-agent.spec.ts`

- [ ] **Step 1: Delete**

```bash
git rm -r src/app/chat src/app/api/chat src/components/chat src/lib/chat src/lib/agent
git rm -rf __tests__/unit/lib/chat __tests__/unit/lib/agent
git rm -rf __tests__/unit/components/chat __tests__/unit/app/chat
git rm __tests__/e2e/chat.spec.ts __tests__/e2e/chat-agent.spec.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: delete chat demo (routes, api, components, lib/chat, lib/agent, tests)"
```

---

### Task 3: Delete the agent-teams demo

**Files:**
- Delete: `src/app/agent-teams/`
- Delete: `src/app/api/agent-teams/`
- Delete: `src/components/agentTeams/`
- Delete: `src/lib/agentTeams/`
- Delete: `src/services/agentTeamService.ts`
- Delete: `__tests__/unit/lib/agentTeams/` (if present)
- Delete: `__tests__/unit/components/agentTeams/` (if present)
- Delete: `__tests__/unit/services/agentTeamService.test.ts`
- Delete: `__tests__/e2e/agent-teams.spec.ts`

- [ ] **Step 1: Delete**

```bash
git rm -r src/app/agent-teams src/app/api/agent-teams src/components/agentTeams src/lib/agentTeams
git rm src/services/agentTeamService.ts
git rm -rf __tests__/unit/lib/agentTeams __tests__/unit/components/agentTeams
git rm __tests__/unit/services/agentTeamService.test.ts
git rm __tests__/e2e/agent-teams.spec.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: delete agent-teams demo (routes, api, components, lib, services, tests)"
```

---

### Task 4: Delete the workflow builder demo

**Files:**
- Delete: `src/app/builder/`
- Delete: `src/components/workflow/`
- Delete: `__tests__/unit/components/workflow/` (if present)
- Delete: `__tests__/unit/app/builder/`
- Delete: `__tests__/e2e/builder.spec.ts`
- Delete: demo-specific top-level docs: `AGENT_TEAM_BUILDER_DEMO.md`, `AGENT_TEAM_BUILDER_POC_DECISIONS.md`
- Delete: `docs/features/chat.md`, `docs/features/workflow-builder.md`
- Delete: `TDD.md` (demo-era TDD guide; superseded by this boilerplate)

- [ ] **Step 1: Delete**

```bash
git rm -r src/app/builder src/components/workflow
git rm -rf __tests__/unit/components/workflow __tests__/unit/app/builder
git rm __tests__/e2e/builder.spec.ts
git rm AGENT_TEAM_BUILDER_DEMO.md AGENT_TEAM_BUILDER_POC_DECISIONS.md TDD.md
git rm docs/features/chat.md docs/features/workflow-builder.md
```

- [ ] **Step 2: Empty `services/` guard**

```bash
ls src/services 2>/dev/null && git rm -r src/services || echo "services already gone"
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete workflow builder demo + retire demo-era docs"
```

---

### Task 5: Verify Phase 1 — tree compiles except for demo-only shared helpers

The remaining compile errors at this point should all point at `src/lib/sse/`, `src/lib/api/`, `src/lib/actions/`, `src/lib/formatters/`, `src/lib/ui/` — demo-only shared helpers we'll delete in Phase 2. Anything else is a surprise.

- [ ] **Step 1: Run lint**

```bash
npm run lint 2>&1 | tee /tmp/lint-phase1.log || true
```

Expected: errors reference only `@/lib/sse`, `@/lib/api/*`, `@/lib/actions/result`, `@/lib/formatters`, or `@/lib/ui/statusStyles` — **or** no errors if nothing still imports them.

- [ ] **Step 2: Log any surprises to `NOTES-FOR-REVIEW.md`**

If lint flags anything outside that set, append a note:

```bash
echo -e "## Phase 1 residual imports\n\n(command output)\n" >> NOTES-FOR-REVIEW.md
```

No commit here — just a local check.

---

## Phase 2 — Delete demo-only shared helpers

### Task 6: Delete `src/lib/sse/`

All SSE consumers (approvals, chat, agent-teams) are gone.

- [ ] **Step 1: Confirm no remaining imports**

```bash
grep -rn "from.*@/lib/sse\|from.*@/lib/sse/" src __tests__ || echo OK
```

Expected: `OK`.

- [ ] **Step 2: Delete and commit**

```bash
git rm -r src/lib/sse
git commit -m "chore: remove src/lib/sse (consumers deleted with demos)"
```

---

### Task 7: Delete `src/lib/api/`

Every file under `src/lib/api/` (`agentTeams.ts`, `approvals.ts`, `client.ts`, `withApi.ts`) was only used by demo routes. All callers deleted.

- [ ] **Step 1: Confirm no remaining imports**

```bash
grep -rn "from.*@/lib/api\|from.*@/lib/api/" src __tests__ || echo OK
```

Expected: `OK`.

- [ ] **Step 2: Delete and commit**

```bash
git rm -r src/lib/api __tests__/unit/lib/api 2>/dev/null
git commit -m "chore: remove src/lib/api (demo-only wrappers + clients)"
```

---

### Task 8: Delete `src/lib/actions/`

`src/lib/actions/result.ts` was consumed only by `app/(protected)/approvals/actions.ts`, now deleted.

- [ ] **Step 1: Confirm no imports**

```bash
grep -rn "from.*@/lib/actions" src __tests__ || echo OK
```

Expected: `OK`.

- [ ] **Step 2: Delete and commit**

```bash
git rm -r src/lib/actions __tests__/unit/lib/actions 2>/dev/null
git commit -m "chore: remove src/lib/actions (demo-only server-action result wrapper)"
```

---

### Task 9: Delete `src/lib/formatters/` and `src/lib/ui/`

`src/lib/formatters/date.ts` and `src/lib/ui/statusStyles.ts` were only used by approvals UI.

- [ ] **Step 1: Confirm no imports**

```bash
grep -rn "from.*@/lib/formatters\|from.*@/lib/ui" src __tests__ || echo OK
```

Expected: `OK`. If anything remains, it's almost certainly in a still-living file that should probably just inline whatever it used — open the offender and decide.

- [ ] **Step 2: Delete and commit**

```bash
git rm -r src/lib/formatters src/lib/ui
git commit -m "chore: remove src/lib/formatters and src/lib/ui (demo-only)"
```

---

## Phase 3 — Dependencies & env

### Task 10: Remove demo dependencies from `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit `package.json` — remove from `dependencies`**

Remove these keys (leave everything else, including all kept Radix primitives):

```
"@langchain/community"
"@langchain/core"
"@langchain/langgraph"
"@langchain/langgraph-checkpoint"
"@langchain/openai"
"@radix-ui/react-dialog"
"@radix-ui/react-select"
"@radix-ui/react-toast"
"@tavily/core"
"ai"
"langchain"
"mathjs"
"openai"
"react-markdown"
"reactflow"
"y-websocket"
"yjs"
```

**Kept Radix primitives** (confirmed by grepping kept `components/ui/`): `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`, `@radix-ui/react-slot`.

- [ ] **Step 2: Remove the `prisma.seed` entry**

In `package.json`, delete:

```json
"prisma": {
  "seed": "node prisma/seed.js"
}
```

- [ ] **Step 3: Reinstall & regenerate lockfile**

```bash
rm -rf node_modules
npm install
```

Expected: install completes; no unmet peer warnings for anything beyond the usual React 19 noise.

- [ ] **Step 4: Lint as smoke test**

```bash
npm run lint
```

Expected: passes (or only complains about things we'll fix later in this plan — note any surprises in `NOTES-FOR-REVIEW.md`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): remove demo-only dependencies (langchain, openai, reactflow, yjs, radix extras, …)"
```

---

### Task 11: Trim `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Remove demo env vars**

Open `.env.example` and delete the `OPENAI_API_KEY`, `TAVILY_API_KEY`, and `CRON_SECRET` lines (and their comments/section headers if present).

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: drop OPENAI_API_KEY, TAVILY_API_KEY, CRON_SECRET from .env.example"
```

---

## Phase 4 — Prisma collapse

### Task 12: Reduce schema to a single `User` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema contents**

Write `prisma/schema.prisma` exactly as:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  entraOid  String   @unique
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([entraOid])
}
```

- [ ] **Step 2: Wipe old migrations**

```bash
git rm -r prisma/migrations
git rm -f prisma/seed.js
```

- [ ] **Step 3: Ensure Docker Postgres is up**

```bash
npm run infra:up
```

Expected: Postgres on 5432 + 5433 reachable.

- [ ] **Step 4: Reset DB and generate fresh init migration**

```bash
npx prisma migrate reset --force --skip-seed
npx prisma migrate dev --name init
```

Expected: a single migration directory `prisma/migrations/<timestamp>_init/` is created; Prisma client regenerates cleanly.

- [ ] **Step 5: Verify no Prisma client usage references deleted models**

```bash
grep -rn "prisma\.\(chat\|message\|approvalRequest\|priorityConfig\|workflow\|workflowNode\|workflowExecution\|workflowStep\)" src __tests__ || echo OK
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "refactor(prisma): collapse schema to User model only + fresh init migration"
```

---

## Phase 5 — Role rename: `Approver`/`Requester` → `User`

### Task 13: Update `roles.ts` tests first (TDD red)

**Files:**
- Modify: `__tests__/unit/lib/auth/roles.test.ts`

- [ ] **Step 1: Replace the test file contents**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Role, parseRolesClaim } from '@/lib/auth/roles'

describe('Role constants', () => {
  it('exposes Admin and User', () => {
    expect(Role.Admin).toBe('Admin')
    expect(Role.User).toBe('User')
  })

  it('does not expose the retired roles', () => {
    expect((Role as Record<string, string>).Approver).toBeUndefined()
    expect((Role as Record<string, string>).Requester).toBeUndefined()
  })
})

describe('parseRolesClaim', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns [User] when claim is missing', () => {
    expect(parseRolesClaim(undefined)).toEqual(['User'])
    expect(parseRolesClaim(null)).toEqual(['User'])
  })

  it('returns [User] and warns when claim is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseRolesClaim('Admin')).toEqual(['User'])
    expect(warn).toHaveBeenCalled()
  })

  it('returns known roles verbatim', () => {
    expect(parseRolesClaim(['Admin'])).toEqual(['Admin'])
    expect(parseRolesClaim(['User'])).toEqual(['User'])
    expect(parseRolesClaim(['Admin', 'User'])).toEqual(['Admin', 'User'])
  })

  it('filters unknown values and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseRolesClaim(['Admin', 'Approver', 'foo'])).toEqual(['Admin'])
    expect(warn).toHaveBeenCalled()
  })

  it('returns [User] when no known roles are present', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseRolesClaim(['Approver', 'Requester'])).toEqual(['User'])
    expect(warn).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test — it must fail**

```bash
npx vitest run __tests__/unit/lib/auth/roles.test.ts
```

Expected: FAIL (Role.User undefined, default is 'Requester', etc.)

---

### Task 14: Update `roles.ts` implementation (TDD green)

**Files:**
- Modify: `src/lib/auth/roles.ts`

- [ ] **Step 1: Replace `roles.ts` contents**

```ts
export const Role = {
  Admin: 'Admin',
  User: 'User',
} as const

export type Role = (typeof Role)[keyof typeof Role]

const KNOWN_ROLES: readonly Role[] = [Role.Admin, Role.User]

export function parseRolesClaim(claim: unknown): Role[] {
  if (!Array.isArray(claim)) {
    if (claim !== undefined && claim !== null) {
      console.warn('[auth/roles] roles claim is not an array; defaulting to User', { claim })
    }
    return [Role.User]
  }

  const known: Role[] = []
  const unknown: unknown[] = []
  for (const value of claim) {
    if (typeof value === 'string' && (KNOWN_ROLES as readonly string[]).includes(value)) {
      known.push(value as Role)
    } else {
      unknown.push(value)
    }
  }

  if (unknown.length > 0) {
    console.warn('[auth/roles] filtered unknown role(s) from claim', { unknown })
  }

  return known.length === 0 ? [Role.User] : known
}
```

- [ ] **Step 2: Run the roles test — expect PASS**

```bash
npx vitest run __tests__/unit/lib/auth/roles.test.ts
```

Expected: PASS.

- [ ] **Step 3: Do NOT commit yet** — there are still downstream references to `Role.Approver` / `Role.Requester` / `APPROVER_ROLES` that will fail typecheck.

---

### Task 15: Update remaining callers of the renamed roles

**Files to update:**
- `src/components/auth/userMenuHelpers.ts` — `primaryRole()` and `roleBadgeClasses()`
- `__tests__/unit/components/auth/userMenuHelpers.test.ts`
- `__tests__/unit/lib/auth/requireRole.test.ts`
- `__tests__/unit/lib/auth/session.test.ts`
- `__tests__/unit/lib/auth/actor.test.ts`
- `__tests__/unit/lib/errors/appError.forbidden.test.ts`
- `__tests__/helpers/mockActor.ts`
- `__tests__/e2e/auth.spec.ts`, `__tests__/e2e/user-menu.spec.ts`, `__tests__/e2e/theme.spec.ts`
- `__tests__/unit/proxy.test.ts` (if it hard-codes roles)

- [ ] **Step 1: Replace `userMenuHelpers.ts`**

```ts
import { Role } from '@/lib/auth/roles'

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
    case Role.Admin:
      return `${BADGE_BASE} bg-primary text-primary-foreground`
    default:
      return `${BADGE_BASE} bg-muted text-muted-foreground`
  }
}

export function primaryRole(roles: readonly Role[]): Role {
  if (roles.includes(Role.Admin)) return Role.Admin
  return Role.User
}
```

- [ ] **Step 2: Fix each test file — replace `'Approver'`/`'Requester'` with `'User'`, and `Role.Approver`/`Role.Requester` with `Role.User`**

Run this sweep, open each file, edit strings/identifiers accordingly (the only substitutions are `Approver → User`, `Requester → User`, `APPROVER_ROLES → [Role.Admin, Role.User]`):

```bash
grep -rln "Approver\|Requester\|APPROVER_ROLES" src __tests__
```

Go file-by-file. For each occurrence:
- `Role.Approver` or `Role.Requester` → `Role.User`
- String literals `'Approver'` / `'Requester'` → `'User'`
- `APPROVER_ROLES` imports/references → delete import; inline `[Role.Admin, Role.User]` at call sites (should be none after demo deletion, but double-check)
- Tests that specifically verify the *distinction* between Approver and Requester should be rewritten: keep the Admin-vs-User distinction, drop the three-tier one

- [ ] **Step 3: Run the full unit suite**

```bash
npm run test:unit
```

Expected: all auth / errors / components tests pass. Coverage will likely dip below 80% because we just deleted a lot of tested code — that's fine for now; Phase 7 adds coverage for the new pages.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(auth): rename roles Approver/Requester → User; default role is User"
```

---

### Task 16: Update Entra setup docs

**Files:**
- Modify: `docs/entra-id-local-setup.md`
- Modify: `docs/azure-production-setup.md`

- [ ] **Step 1: In both docs, replace references**

In each doc, update:
- App role **Display name**: "Approver" → "User" (or "Standard User" — use "User" to match the code)
- App role **Value**: `Approver` → `User`
- Remove the "Requester" role entirely — the doc should describe exactly two roles (`Admin`, `User`)
- Update any narrative text ("Approvers can lock/approve requests…") to reflect the generic RBAC example at `/settings/admin`

Use a grep to find every Approver/Requester reference in the two docs and rewrite in context. Don't blind-substitute — the surrounding sentences may need rewording.

- [ ] **Step 2: Commit**

```bash
git add docs/entra-id-local-setup.md docs/azure-production-setup.md
git commit -m "docs(auth): update app-role Value strings to Admin/User"
```

---

## Phase 6 — New pages

### Task 17: Make `/` public in the proxy

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Update `isPublicPath`**

Change the function in `src/proxy.ts` to include `/`:

```ts
function isPublicPath(pathname: string): boolean {
  return pathname === '/' ||
    pathname === '/auth/signin' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/signout' ||
    pathname.startsWith('/auth/unauthorized') ||
    pathname === '/auth/signin/'
}
```

- [ ] **Step 2: Update or add a proxy unit test case**

Open `__tests__/unit/proxy.test.ts`. Ensure there is a test that asserts `/` is treated as public (no redirect). If one doesn't exist, add it modeled on the existing public-path tests.

```bash
npx vitest run __tests__/unit/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts __tests__/unit/proxy.test.ts
git commit -m "feat(proxy): treat / as public (landing page)"
```

---

### Task 18: Replace `GlobalNav` with a simple authenticated nav

**Files:**
- Modify: `src/components/nav/GlobalNav.tsx`

- [ ] **Step 1: Replace contents**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    match: (p: string) => p === '/dashboard' || p.startsWith('/dashboard/'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (p: string) => p === '/settings' || p.startsWith('/settings/'),
  },
] as const

export default function GlobalNav() {
  const pathname = usePathname() ?? '/'

  if (pathname.startsWith('/auth/') || pathname === '/') return null

  return (
    <nav
      aria-label="Global"
      data-testid="global-nav"
      className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1 shadow-sm backdrop-blur"
    >
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            data-testid={`global-nav-${href.slice(1)}`}
            className={cn(
              'focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/nav/GlobalNav.tsx
git commit -m "refactor(nav): strip demo links; leave Dashboard + Settings"
```

---

### Task 19: Rewrite `src/app/page.tsx` as a public landing

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import Link from 'next/link'
import { getSessionForClient } from '@/lib/auth/actor'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const session = await getSessionForClient()
  const href = session ? '/dashboard' : '/auth/signin'
  const ctaLabel = session ? 'Go to dashboard' : 'Sign in'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Next.js Enterprise Boilerplate
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          A production-ready starter with Microsoft Entra ID authentication,
          OpenTelemetry observability, Prisma + Postgres, and a TDD harness.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href={href}>{ctaLabel}</Link>
      </Button>
    </main>
  )
}
```

- [ ] **Step 2: Update or replace `__tests__/unit/app/page.test.tsx`**

Replace the file with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn(),
}))

import { getSessionForClient } from '@/lib/auth/actor'

describe('Home page', () => {
  it('shows "Sign in" CTA when unauthenticated', async () => {
    vi.mocked(getSessionForClient).mockResolvedValue(null)
    render(await Home())
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/auth/signin')
  })

  it('shows "Go to dashboard" CTA when authenticated', async () => {
    vi.mocked(getSessionForClient).mockResolvedValue({
      userId: 'u1',
      roles: ['User'],
      name: 'Jane',
      email: 'j@example.com',
      photoUrl: null,
    })
    render(await Home())
    const link = screen.getByRole('link', { name: /go to dashboard/i })
    expect(link).toHaveAttribute('href', '/dashboard')
  })
})
```

- [ ] **Step 3: Run the test**

```bash
npx vitest run __tests__/unit/app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx __tests__/unit/app/page.test.tsx
git commit -m "feat(home): public landing page with session-aware CTA"
```

---

### Task 20: Create the `(protected)` route group

The existing repo already has `src/app/(protected)/layout.tsx` with approvals-specific logic (it may reference approvals services). Rewrite it as a generic authenticated shell.

**Files:**
- Modify: `src/app/(protected)/layout.tsx`

- [ ] **Step 1: Replace layout contents**

```tsx
import type { ReactNode } from 'react'
import { getSessionForClient } from '@/lib/auth/actor'
import GlobalNav from '@/components/nav/GlobalNav'
import UserMenu from '@/components/auth/UserMenu'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { SessionProvider } from '@/components/auth/session-provider'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getSessionForClient()
  // Middleware guarantees a session on /(protected)/** routes, but narrow for TypeScript.
  if (!session) return null

  return (
    <SessionProvider value={session}>
      <div className="min-h-screen">
        <GlobalNav />
        <header className="fixed right-4 top-3 z-50 flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-20">{children}</main>
      </div>
    </SessionProvider>
  )
}
```

*Note:* The import paths for `SessionProvider`, `UserMenu`, `ThemeToggle` should match existing files (`src/components/auth/session-provider.tsx`, etc.). If naming differs, adjust paths — do not rename the existing files.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(protected\)/layout.tsx
git commit -m "refactor((protected)): generic authenticated shell (nav + user menu + theme toggle)"
```

---

### Task 21: Create `/dashboard` page

**Files:**
- Create: `src/app/(protected)/dashboard/page.tsx`
- Create: `__tests__/unit/app/dashboard/page.test.tsx`

- [ ] **Step 1: Write the test first (TDD)**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '@/app/(protected)/dashboard/page'

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn().mockResolvedValue({
    userId: 'u1',
    roles: ['User'],
    name: 'Jane Doe',
    email: 'jane@example.com',
    photoUrl: null,
  }),
}))

describe('Dashboard page', () => {
  it('greets the signed-in user by name', async () => {
    render(await Dashboard())
    expect(screen.getByRole('heading', { name: /welcome, jane doe/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (file not found)**

```bash
npx vitest run __tests__/unit/app/dashboard/page.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/(protected)/dashboard/page'`

- [ ] **Step 3: Implement the page**

```tsx
import { getSessionForClient } from '@/lib/auth/actor'

export default async function Dashboard() {
  const session = await getSessionForClient()
  const displayName = session?.name ?? session?.email ?? 'there'

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {displayName}
      </h1>
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Getting started</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is your application dashboard. Use Settings to view your profile
          and explore the admin-only section.
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run __tests__/unit/app/dashboard/page.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(protected\)/dashboard __tests__/unit/app/dashboard
git commit -m "feat(dashboard): simple authenticated welcome page"
```

---

### Task 22: Create `/settings` layout with sub-nav

**Files:**
- Create: `src/app/(protected)/settings/layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { getActor } from '@/lib/auth/actor'
import { Role } from '@/lib/auth/roles'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const actor = await getActor()
  const isAdmin = actor.roles.includes(Role.Admin)

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Settings
        </h2>
        <nav aria-label="Settings" className="flex flex-col gap-1 text-sm">
          <Link
            href="/settings"
            className="rounded px-2 py-1 hover:bg-accent hover:text-foreground"
          >
            Profile
          </Link>
          {isAdmin && (
            <Link
              href="/settings/admin"
              className="rounded px-2 py-1 hover:bg-accent hover:text-foreground"
            >
              Admin
            </Link>
          )}
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(protected\)/settings/layout.tsx
git commit -m "feat(settings): layout with sub-nav (Profile + Admin when authorized)"
```

---

### Task 23: Create `/settings` profile page

**Files:**
- Create: `src/app/(protected)/settings/page.tsx`
- Create: `__tests__/unit/app/settings/page.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Settings from '@/app/(protected)/settings/page'

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn().mockResolvedValue({
    userId: 'u1',
    roles: ['User'],
    name: 'Jane Doe',
    email: 'jane@example.com',
    photoUrl: null,
  }),
}))

describe('Settings (profile) page', () => {
  it('renders the user name, email, and role', async () => {
    render(await Settings())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText(/role/i)).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run __tests__/unit/app/settings/page.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
import { getSessionForClient } from '@/lib/auth/actor'
import { primaryRole } from '@/components/auth/userMenuHelpers'

export default async function Settings() {
  const session = await getSessionForClient()
  if (!session) return null

  const role = primaryRole(session.roles)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <dl className="grid gap-4 text-sm sm:grid-cols-[120px_1fr]">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{session.name ?? '—'}</dd>

        <dt className="text-muted-foreground">Email</dt>
        <dd>{session.email ?? '—'}</dd>

        <dt className="text-muted-foreground">Role</dt>
        <dd>{role}</dd>
      </dl>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run __tests__/unit/app/settings/page.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(protected\)/settings/page.tsx __tests__/unit/app/settings
git commit -m "feat(settings): profile page showing name, email, role"
```

---

### Task 24: Create `/settings/admin` role-gated page

**Files:**
- Create: `src/app/(protected)/settings/admin/page.tsx`
- Create: `__tests__/unit/app/settings/admin.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppError } from '@/lib/errors/AppError'

vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn(),
}))

import { requireRole } from '@/lib/auth/requireRole'
import AdminSettings from '@/app/(protected)/settings/admin/page'

describe('Settings/Admin page', () => {
  it('renders for an Admin actor', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'u1', roles: ['Admin'] })
    render(await AdminSettings())
    expect(screen.getByRole('heading', { name: /admin/i })).toBeInTheDocument()
    expect(requireRole).toHaveBeenCalledWith('Admin')
  })

  it('propagates AppError when requireRole rejects', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden' })
    )
    await expect(AdminSettings()).rejects.toBeInstanceOf(AppError)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run __tests__/unit/app/settings/admin.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
import { requireRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'

export default async function AdminSettings() {
  await requireRole(Role.Admin)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          This page is only visible to users with the <code>Admin</code> role.
          It illustrates server-side role enforcement via{' '}
          <code>requireRole(Role.Admin)</code>.
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run __tests__/unit/app/settings/admin.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(protected\)/settings/admin __tests__/unit/app/settings/admin.test.tsx
git commit -m "feat(settings/admin): role-gated admin example page"
```

---

### Task 25: Dashboard should be the post-signin default

**Files:**
- Check: `src/app/auth/callback/route.ts` (or wherever `returnTo` fallback is set)

- [ ] **Step 1: Find where returnTo default lives**

```bash
grep -rn "returnTo\|'/'" src/app/auth src/lib/auth | head -30
```

- [ ] **Step 2: Update the default**

If the callback has a literal `'/'` fallback for post-sign-in redirect, change it to `'/dashboard'`. Look for a pattern like `returnTo ?? '/'` or `redirectTo = '/'`. Don't touch the `isPublicPath` in `proxy.ts` — that already includes `/`.

- [ ] **Step 3: Update/confirm a callback test asserts the default**

Open `__tests__/integration/auth/callback.test.ts`. If there's a "no returnTo → redirects to X" test, update X to `/dashboard`. If no such test exists, **do not add one** — keep existing coverage.

- [ ] **Step 4: Run the callback integration test**

```bash
npm run test:integration -- callback
```

Expected: PASS. If it relies on test DB, `npm run infra:up` first.

- [ ] **Step 5: Commit (only if changes were needed)**

```bash
git add -A
git commit -m "feat(auth): default post-signin redirect is /dashboard"
```

---

## Phase 7 — E2E tests for the five golden flows

### Task 26: Update/add Playwright specs for the new pages

**Files:**
- Modify: `__tests__/e2e/auth.spec.ts` (likely already covers signin/signout)
- Modify: `__tests__/e2e/home.spec.ts`
- Create: `__tests__/e2e/dashboard.spec.ts`
- Create: `__tests__/e2e/settings.spec.ts`

**Helper context:** `__tests__/helpers/mockSession.ts` exists and injects a pre-baked JWE cookie. Use its existing API (`mockSessionAs({ role: 'Admin' | 'User', … })` — consult the file; do not invent a new API).

- [ ] **Step 1: Read the mockSession helper**

```bash
cat __tests__/helpers/mockSession.ts
```

Note the exact export names and signature.

- [ ] **Step 2: Update `home.spec.ts` to assert the two CTAs**

Rewrite/augment to cover:
- Unauthed visit to `/` → "Sign in" link present, link points at `/auth/signin`
- Authed visit (session cookie injected) to `/` → "Go to dashboard" link present, points at `/dashboard`

- [ ] **Step 3: Create `dashboard.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { mockSessionAs } from '../helpers/mockSession'

test.describe('Dashboard', () => {
  test('unauthenticated visit redirects to signin with returnTo', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/signin\?returnTo=%2Fdashboard/)
  })

  test('authenticated User can reach /dashboard', async ({ page, context }) => {
    await mockSessionAs(context, { role: 'User' })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome/i)
  })
})
```

Adjust `mockSessionAs` signature to match the helper's actual API.

- [ ] **Step 4: Create `settings.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { mockSessionAs } from '../helpers/mockSession'

test.describe('Settings', () => {
  test('authenticated User sees profile but no Admin sub-link', async ({ page, context }) => {
    await mockSessionAs(context, { role: 'User' })
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /admin/i })).toHaveCount(0)
  })

  test('User hitting /settings/admin is redirected to unauthorized', async ({ page, context }) => {
    await mockSessionAs(context, { role: 'User' })
    await page.goto('/settings/admin')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('Admin sees the admin sub-link and the admin page', async ({ page, context }) => {
    await mockSessionAs(context, { role: 'Admin' })
    await page.goto('/settings')
    await expect(page.getByRole('link', { name: /admin/i })).toBeVisible()
    await page.getByRole('link', { name: /admin/i }).click()
    await expect(page).toHaveURL(/\/settings\/admin/)
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible()
  })
})
```

- [ ] **Step 5: Run E2E**

```bash
npm run test:e2e -- home dashboard settings auth
```

Expected: PASS.

If `AppError` forbidden produces a 403 response rather than a redirect, then the "User hitting /settings/admin is redirected to unauthorized" test will fail — consult the existing handling. Two valid behaviors:
  1. The existing protected layout / error boundary redirects 403 → `/auth/unauthorized` (preferred)
  2. The 403 renders an error page inline

If (1) is already wired, the test above works as written. If not, update the spec to assert whichever behavior is actually implemented, and append a note to `NOTES-FOR-REVIEW.md` so the user can decide whether to add a redirect.

- [ ] **Step 6: Commit**

```bash
git add __tests__/e2e
git commit -m "test(e2e): cover landing, dashboard, settings flows (Admin + User paths)"
```

---

## Phase 8 — Docs rewrite

### Task 27: Rewrite `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace contents with:**

```markdown
# Next.js Enterprise Boilerplate

A production-ready Next.js 16 starter with Microsoft Entra ID authentication,
OpenTelemetry observability, Prisma + PostgreSQL, and a TDD harness. Everything
wired up so you can start building features immediately.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL · Prisma 5 |
| Auth | Microsoft Entra ID via MSAL Node (single-tenant, PKCE) · JWE session cookies via `jose` |
| Observability | OpenTelemetry → OTLP collector → Jaeger + Prometheus + Grafana |
| Styling | Tailwind CSS (class-based dark mode, CSS variables) |
| Testing | Vitest (unit + integration) · Playwright (E2E) · MSW |
| Container | Docker Compose or Podman Compose (local infra) |

## Prerequisites

- Node 20+
- Docker or Podman (`podman machine` on macOS/Windows)
- A Microsoft Entra tenant (free M365 Developer tenant works — see setup guide)

## Quick start

```bash
git clone <your-repo-url>
cd nextjs-boiler-plate
npm install

cp .env.example .env              # Fill in values — see below
npm run infra:up                  # Postgres + OTEL stack
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The landing page is public; sign in to reach
`/dashboard` and `/settings`.

## Environment

Minimum in `.env`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/nextjs_boilerplate
APP_URL=http://localhost:3000
AUTH_SESSION_SECRET=$(openssl rand -base64 32)

AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
```

Integration tests use a separate DB on `5433` (provided by the Docker stack).

## Authentication & roles

Every environment needs a real Entra tenant. Two canonical app roles in
`src/lib/auth/roles.ts`: `Admin` and `User`. Authorization is enforced
server-side next to each verb via `requireRole()` / `requireAnyRole()`.
Client `useSession()` is for cosmetic UI gating only.

The `/settings/admin` page is the reference example — it calls
`await requireRole('Admin')` server-side; non-admins are redirected to
`/auth/unauthorized`.

Full setup: **[docs/entra-id-local-setup.md](./docs/entra-id-local-setup.md)** (local)
· **[docs/azure-production-setup.md](./docs/azure-production-setup.md)** (production runbook).

## Commands

```bash
npm run dev              # Dev server
npm run build            # Production build
npm test                 # Vitest (watch)
npm run test:unit        # Vitest with coverage (one-shot)
npm run test:integration # Integration tests (requires test DB on 5433)
npm run test:e2e         # Playwright
npm run lint             # ESLint
npm run format           # Prettier

npm run db:migrate       # prisma migrate dev
npm run db:generate      # Regenerate Prisma client
npm run db:studio        # Prisma Studio UI

npm run infra:up         # Start infra stack (Docker or Podman — auto-detected)
npm run infra:down       # Stop infra stack
npm run infra:logs       # Tail infra logs
```

## Observability

Dashboards bundled with the local infra:

- **Jaeger** — http://localhost:16686 (traces)
- **Prometheus** — http://localhost:9090 (metrics)
- **Grafana** — http://localhost:3001 (admin/admin)

See [OPENTELEMETRY.md](./OPENTELEMETRY.md) for span naming conventions and
how to add custom spans.

## Project layout

```
src/
├── app/
│   ├── page.tsx                 # Public landing
│   ├── layout.tsx
│   ├── (protected)/             # Auth-gated route group
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   └── settings/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       └── admin/page.tsx   # requireRole('Admin')
│   └── auth/                    # signin / callback / signout / unauthorized
├── components/                  # auth, nav, theme, ui
├── lib/                         # auth, errors, telemetry, prisma, utils
├── providers/                   # theme provider
└── proxy.ts                     # Edge session gate (Next 16 "proxy" naming)

__tests__/
├── unit/ · integration/ · e2e/
├── mocks/                       # MSW + Entra mocks
└── helpers/

prisma/      # schema.prisma, migrations/
infra/       # docker-compose + otel/prometheus/grafana config
docs/        # auth runbooks + theming + superpowers specs/plans
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — architecture reference for agents/contributors
- **[OPENTELEMETRY.md](./OPENTELEMETRY.md)** — tracing conventions
- **[infra/README.md](./infra/README.md)** — Docker stack details
- **[docs/entra-id-local-setup.md](./docs/entra-id-local-setup.md)** — local tenant + app registration walkthrough
- **[docs/azure-production-setup.md](./docs/azure-production-setup.md)** — production deployment runbook
- **[docs/features/theming.md](./docs/features/theming.md)** — dark mode + design tokens

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for the boilerplate"
```

---

### Task 28: Rewrite `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace contents with a trimmed architecture reference**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

\`\`\`bash
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Build for production
npm test                 # Run unit tests (watch mode)
npm run test:unit        # Run unit tests with coverage (one-shot)
npm run test:integration # Run integration tests (requires live DB on port 5433)
npm run test:e2e         # Run Playwright E2E tests
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Database
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate       # Run migrations (dev)
npm run db:studio        # Open Prisma Studio

# Infrastructure (Docker)
npm run infra:up         # Start PostgreSQL, OTEL Collector, Jaeger, Prometheus, Grafana
npm run infra:down       # Stop all infrastructure
\`\`\`

## Environment Setup

Copy `.env.example` → `.env` and configure:
- `DATABASE_URL` — PostgreSQL (default port 5432 via Docker)
- `APP_URL` — Absolute app URL (e.g., `http://localhost:3000`); used to build the Entra redirect URI and validate `returnTo`
- `AUTH_SESSION_SECRET` — ≥32-byte base64 secret; HKDF input for the JWE session key. Generate with `openssl rand -base64 32`
- `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` — Entra ID app registration (single-tenant). See setup guide below

Integration tests use a separate DB on port 5433 (`TEST_DATABASE_URL` or a test-specific `.env.test`).

### Local Entra ID setup

Auth has **no dev fallback** — every environment needs a real Entra tenant. For step-by-step instructions, see **`docs/entra-id-local-setup.md`**.

## Architecture

### Auth (Entra ID + MSAL Node)

Microsoft Entra ID via MSAL Node (Authorization Code + PKCE, single-tenant). **No dev fallback.** Browser never holds tokens.

- **Runtime split**: `src/proxy.ts` is the Next.js 16 proxy (edge middleware). It decrypts the JWE session cookie with `jose`, gates every non-public route, and forwards the verified payload via `SESSION_HEADER` so Node-side `getActor()` / `getSessionForClient()` skip a redundant decrypt. `/auth/{signin,callback,signout}` route handlers run on Node (MSAL + Prisma + Graph).
- **Session**: encrypted cookie (JWE), 12h TTL with sliding refresh at 6h via `getActor()` — see `src/lib/auth/session.ts`, `src/lib/auth/cookies.ts`. Secret derived via HKDF-SHA256 from `AUTH_SESSION_SECRET`.
- **Authorization**: `authN` enforced in the proxy; `authZ` enforced next to each verb. Use `await requireRole('Admin')` or `requireAnyRole(['Admin','User'])` from `src/lib/auth/requireRole.ts` inside server components / Server Actions. Throws `AppError.forbidden()` → 403 / redirect to `/auth/unauthorized`.
- **Roles**: two canonical values in `src/lib/auth/roles.ts` — `Admin` and `User`. Missing/unknown claim defaults to `User`. App Role **Value** strings in the Entra portal must match these exactly.
- **Client-side session**: protected layout calls `getSessionForClient()` server-side and passes non-secret facts (`userId`, `roles`, `name`, `email`, `photoUrl`) to `<SessionProvider>`. Client `useSession()` is for cosmetic UI gating only — authoritative enforcement is always server-side `requireRole()`.
- **User provisioning**: `prisma.user.upsert({ where: { entraOid } })` on every callback — `entraOid` (Entra `oid` claim) is the stable identity. Profile photo fetched once via Graph `/me/photo/$value` at sign-in and cached on `User.image`.
- **Testing**: unit tests mock MSAL + Graph via MSW (`__tests__/mocks/entra.ts`); integration tests use MSW + real test DB; E2E injects pre-baked JWE cookies via `__tests__/helpers/mockSession.ts`. No test ever hits real Entra.

### Reference RBAC example

`src/app/(protected)/settings/admin/page.tsx` calls `await requireRole(Role.Admin)` at the top. Non-admin users throw `AppError.forbidden()`. Use this as the pattern when adding new role-gated pages or verbs.

### Adding a feature — recommended layering

When a feature has any business logic, use the three-layer pattern:

1. **Repository** — raw Prisma queries behind an interface (e.g., `IFooRepository`), for dependency injection in service tests
2. **Service** — business logic, accepts the repository via constructor injection, throws typed `AppError` instances
3. **Route handler** — validates input with Zod, calls the service, delegates error formatting to `handleApiError` from `src/lib/errors/handler.ts`

### Error Handling

`src/lib/errors/AppError.ts` defines typed errors with HTTP status codes. Factory functions (`notFound`, `forbidden`, etc.) create domain errors. `handleApiError` in `src/lib/errors/handler.ts` translates `AppError` to JSON responses. Throw `AppError` from services; catch with `handleApiError` in routes.

### Telemetry

`src/instrumentation.ts` is the Next.js instrumentation hook. Node runtime uses `src/lib/telemetry/instrumentation.node.ts`; Edge runtime uses `.edge.ts`. Wrap operations with `createSpan('span.name', async () => {...})` from `src/lib/telemetry/tracing.ts`.

### Database Schema

One model: `User` — `entraOid` (unique) is the stable Entra identity; `id` is cuid. Users are provisioned on first sign-in — there is no seed.

### Testing Conventions

- Unit tests: `__tests__/unit/` — jsdom environment, 80% coverage threshold enforced
- Integration tests: `__tests__/integration/` — node environment, hits real test DB, 30s timeout
- E2E tests: `__tests__/e2e/` — Playwright
- Mocks: `__tests__/mocks/` — MSW handlers

### Path Alias

`@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md for the boilerplate (two roles, no demo domains)"
```

---

### Task 29: Clean up `docs/superpowers/specs/` and `docs/superpowers/plans/`

**Files:**
- Delete: old demo specs and plans in `docs/superpowers/`

- [ ] **Step 1: Audit**

```bash
ls docs/superpowers/specs docs/superpowers/plans
```

- [ ] **Step 2: Delete demo-era design docs**

Keep:
- `docs/superpowers/specs/2026-04-19-entra-id-auth-design.md`
- `docs/superpowers/specs/2026-04-19-react-19-next-16-modernization-design.md`
- `docs/superpowers/specs/2026-04-20-user-profile-menu-design.md`
- `docs/superpowers/specs/2026-04-20-boilerplate-gutout-design.md`
- `docs/superpowers/plans/2026-04-19-entra-id-auth.md`
- `docs/superpowers/plans/2026-04-20-user-profile-menu.md`
- `docs/superpowers/plans/2026-04-20-boilerplate-gutout.md` (this plan)

Delete everything else in those directories (approvals specs, chat specs, workflow specs, agent-team specs, etc.).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers
git commit -m "docs: drop demo-era superpowers specs/plans"
```

---

## Phase 9 — Final verification

### Task 30: Full verification sweep

- [ ] **Step 1: Clean install**

```bash
rm -rf node_modules .next
npm install
```

Expected: completes with no unmet peer warnings beyond the usual React 19 noise.

- [ ] **Step 2: Prisma generate + fresh migrate**

```bash
npm run infra:up
npm run db:generate
npx prisma migrate reset --force --skip-seed
```

Expected: single `init` migration applies cleanly.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: passes with zero errors.

- [ ] **Step 4: Unit tests + coverage**

```bash
npm run test:unit
```

Expected: all tests pass, coverage ≥ 80%.

If coverage is below 80%: the new pages and role-rename changes may need additional tests. Inspect the coverage report, add targeted tests, and re-run. Do not lower the threshold.

- [ ] **Step 5: Integration tests**

```bash
npm run test:integration
```

Expected: passes against test DB on 5433.

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: succeeds; no module-not-found errors.

- [ ] **Step 7: E2E**

```bash
npm run test:e2e
```

Expected: all specs pass.

- [ ] **Step 8: Grep sweep for residual references**

```bash
for term in approval chat agent workflow tavily langchain langgraph mathjs reactflow yjs Approver Requester; do
  echo "=== $term ==="
  grep -rln --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=playwright-report --exclude-dir=test-results "$term" . || echo "  (none)"
done
```

Expected: only unavoidable matches — e.g., `chat` might appear inside `@radix-ui` types in `node_modules` (filtered out above), or the word "chart" which contains "chat" (re-inspect any hit). Any other residue goes into `NOTES-FOR-REVIEW.md` with a judgment call on whether to delete it.

- [ ] **Step 9: Manual smoke**

```bash
npm run dev
```

In a browser:
1. Visit `/` unauthed — see "Sign in" CTA → click → Entra sign-in flow starts
2. After sign-in, redirected to `/dashboard` — welcome banner present
3. Click Settings in the nav — profile displayed
4. If you have the Admin role assigned, click Admin sub-link — admin panel visible
5. Sign out via the user menu — redirected to `/`
6. Check Jaeger (http://localhost:16686) — at least one trace for the page load

- [ ] **Step 10: Final commit (if any docs/test adjustments were made above)**

```bash
git status
# If anything staged:
git commit -m "chore: final verification adjustments"
```

- [ ] **Step 11: Log any deferred decisions**

If `NOTES-FOR-REVIEW.md` has contents, commit it:

```bash
test -s NOTES-FOR-REVIEW.md && git add NOTES-FOR-REVIEW.md && git commit -m "docs: open items for user review"
```

---

## Done state

- Branch `boilerplate-cleanup` has all commits above
- `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run build`, `npm run test:e2e` all pass
- Grep sweep returns no demo-domain references
- Three working pages: `/` (public), `/dashboard` (authed), `/settings` (authed), `/settings/admin` (Admin-only)
- Two roles: `Admin`, `User`
- One Prisma model: `User`
- `NOTES-FOR-REVIEW.md` committed if any judgment calls were deferred
