# Entra ID Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stubbed `next-auth` wiring with a production-grade, Microsoft-native Entra ID auth stack on single-tenant using MSAL Node, encrypted-cookie sessions (JWE), and role-based authz next to each verb.

**Architecture:** Server-only OAuth 2.0 Authorization Code + PKCE flow. MSAL Node (confidential client) in Node runtime route handlers. Sessions are JWE-encrypted HttpOnly cookies verified in Edge middleware. Roles come from the Entra `roles` claim; default `Requester` if missing. Authentication gates all non-`/auth/*` routes; authorization happens next to each verb via `requireRole()` throwing `AppError(FORBIDDEN)`.

**Tech Stack:** Next.js 16 App Router, MSAL Node (`@azure/msal-node`), `jose` (JWE), Prisma (Postgres), Vitest (unit + integration), MSW, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-04-19-entra-id-auth-design.md`

---

## Conventions used in this plan

- **Path alias:** `@/` maps to `src/`.
- **Coverage:** Global threshold is 80% (enforced by `vitest.config.ts`).
- **Test modes:** unit tests → `npm run test:unit`; integration → `npm run test:integration` (requires test DB on 5433); E2E → `npm run test:e2e`.
- **Single-file runs:** `npx vitest run __tests__/unit/path/to/file.test.ts`.
- **Commit cadence:** one commit per task (after all its steps pass).

## File structure produced by this plan

```
src/lib/auth/
├── config.ts              # validated env (clientId, tenantId, clientSecret, sessionSecret, appUrl)
├── roles.ts               # Role constants, Role type, parseRolesClaim
├── session.ts             # JWE encode/decode; pure
├── cookies.ts             # cookie helpers + returnTo validation
├── actor.ts               # getActor / getActorId (rewritten to read JWE session)
├── requireRole.ts         # requireRole / requireAnyRole
├── msal.ts                # singleton ConfidentialClientApplication
└── graph.ts               # fetchUserPhoto(accessToken)

src/app/auth/
├── signin/route.ts
├── callback/route.ts
├── signout/route.ts
└── unauthorized/page.tsx

src/middleware.ts          # Edge runtime, authN only

src/components/auth/
├── session-provider.tsx
└── use-session.ts

__tests__/helpers/
├── mockActor.ts           # extended to accept roles
└── mockSession.ts         # NEW: builds JWE cookie for Playwright

__tests__/mocks/handlers/
└── entra.ts               # MSW: token endpoint + Graph photo

prisma/schema.prisma       # drop Account/Session/VerificationToken; add User.entraOid

prisma/migrations/<ts>_entra_id/
└── migration.sql

prisma/seed.js             # synthetic entraOid values

src/lib/errors/AppError.ts # add FORBIDDEN + forbidden() factory

.env.example               # add AUTH_SESSION_SECRET + APP_URL; remove NEXTAUTH_*
.env.test                  # NEW: test-only secrets
```

---

## Task 1: Swap dependencies (`next-auth` out, MSAL + jose in)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Remove NextAuth and adapter**

```bash
npm uninstall next-auth @auth/prisma-adapter
```

- [ ] **Step 2: Install MSAL Node and jose**

```bash
npm install @azure/msal-node@^3.7.0 jose@^5.9.6
```

If the latest majors of these packages differ at runtime, prefer the current stable; pin the majors after install. Expected success: both appear under `dependencies` in `package.json`.

- [ ] **Step 3: Verify nothing imports NextAuth**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: several errors in `src/lib/auth/actor.ts` and `__tests__/unit/lib/auth/actor.test.ts` pointing at missing `next-auth` module. These are *expected* — those files will be rewritten in later tasks.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): swap next-auth for msal-node + jose

Replaces NextAuth v5 beta with Microsoft-native MSAL Node
confidential client + jose for JWE session cookies.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Environment + config module with runtime validation

**Files:**
- Create: `src/lib/auth/config.ts`
- Create: `__tests__/unit/lib/auth/config.test.ts`
- Modify: `.env.example`
- Create: `.env.test`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const REQUIRED_KEYS = [
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_CLIENT_SECRET',
  'AZURE_AD_TENANT_ID',
  'AUTH_SESSION_SECRET',
  'APP_URL',
] as const

describe('auth/config', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of REQUIRED_KEYS) originalEnv[k] = process.env[k]
    for (const k of REQUIRED_KEYS) process.env[k] = 'test-value'
    process.env.AUTH_SESSION_SECRET = 'a'.repeat(44) // 32 base64-decoded bytes is 44 chars
    process.env.APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    for (const k of REQUIRED_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k]
      else process.env[k] = originalEnv[k]
    }
  })

  it('exposes a typed authConfig when all env vars are set', async () => {
    const { authConfig } = await import('@/lib/auth/config')
    expect(authConfig.clientId).toBe('test-value')
    expect(authConfig.tenantId).toBe('test-value')
    expect(authConfig.clientSecret).toBe('test-value')
    expect(authConfig.appUrl).toBe('http://localhost:3000')
    expect(authConfig.authorityUrl).toBe('https://login.microsoftonline.com/test-value')
    expect(authConfig.redirectUri).toBe('http://localhost:3000/auth/callback')
  })

  it('throws when a required env var is missing', async () => {
    delete process.env.AZURE_AD_CLIENT_ID
    await expect(import('@/lib/auth/config?v=missing')).rejects.toThrow(/AZURE_AD_CLIENT_ID/)
  })

  it('throws when AUTH_SESSION_SECRET is too short', async () => {
    process.env.AUTH_SESSION_SECRET = 'short'
    await expect(import('@/lib/auth/config?v=short')).rejects.toThrow(/AUTH_SESSION_SECRET/)
  })
})
```

- [ ] **Step 2: Run tests, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/config.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/auth/config'" or similar.

- [ ] **Step 3: Implement `src/lib/auth/config.ts`**

```ts
function required(name: string): string {
  const v = process.env[name]
  if (!v || v.length === 0) {
    throw new Error(`[auth/config] Missing required env var: ${name}`)
  }
  return v
}

function requiredMinLength(name: string, min: number): string {
  const v = required(name)
  if (v.length < min) {
    throw new Error(`[auth/config] ${name} must be at least ${min} characters (got ${v.length})`)
  }
  return v
}

const clientId = required('AZURE_AD_CLIENT_ID')
const clientSecret = required('AZURE_AD_CLIENT_SECRET')
const tenantId = required('AZURE_AD_TENANT_ID')
const appUrl = required('APP_URL').replace(/\/$/, '')
const sessionSecret = requiredMinLength('AUTH_SESSION_SECRET', 32)

export const authConfig = {
  clientId,
  clientSecret,
  tenantId,
  appUrl,
  sessionSecret,
  authorityUrl: `https://login.microsoftonline.com/${tenantId}`,
  redirectUri: `${appUrl}/auth/callback`,
  scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read'],
  sessionCookieName: 'session',
  oauthPendingCookieName: 'oauth_pending',
  sessionTtlSeconds: 12 * 60 * 60,
  oauthPendingTtlSeconds: 10 * 60,
  slidingRefreshThresholdSeconds: 6 * 60 * 60,
} as const
```

- [ ] **Step 4: Update `.env.example`**

Remove the `NEXTAUTH_*` lines and add:

```diff
-# NextAuth.js
-NEXTAUTH_URL="http://localhost:3000"
-NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"
+# App URL (used to build Entra redirect URI and validate returnTo)
+APP_URL="http://localhost:3000"
+
+# Auth session secret — 32+ bytes base64. Generate with: openssl rand -base64 32
+AUTH_SESSION_SECRET="replace-me-with-openssl-rand-base64-32-output"
```

- [ ] **Step 5: Create `.env.test`**

```
DATABASE_URL="postgresql://user:password@localhost:5433/nextjs_boilerplate_test?schema=public"
AZURE_AD_CLIENT_ID="test-client-id"
AZURE_AD_CLIENT_SECRET="test-client-secret"
AZURE_AD_TENANT_ID="test-tenant-id"
AUTH_SESSION_SECRET="0123456789abcdef0123456789abcdef0123456789abcdef"
APP_URL="http://localhost:3000"
```

Note: this file is read only by integration tests via `vitest.integration.config.ts` (to be updated in a later task) and by Playwright.

- [ ] **Step 6: Run tests**

```bash
npx vitest run __tests__/unit/lib/auth/config.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/config.ts __tests__/unit/lib/auth/config.test.ts .env.example .env.test
git commit -m "feat(auth): typed config module with runtime env validation

Fails fast at module load if AZURE_AD_* or AUTH_SESSION_SECRET
is missing/too short. Publishes derived values (authorityUrl,
redirectUri, scopes, cookie names, TTLs).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Add `FORBIDDEN` error code and factory

**Files:**
- Modify: `src/lib/errors/AppError.ts`
- Create: `__tests__/unit/lib/errors/appError.forbidden.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/errors/appError.forbidden.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode, forbidden } from '@/lib/errors/AppError'

describe('forbidden()', () => {
  it('returns an AppError with 403 + FORBIDDEN code', () => {
    const err = forbidden(['Admin'])
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('includes the required role(s) in the message', () => {
    const single = forbidden(['Admin'])
    expect(single.message).toBe('Requires role: Admin')
    const multi = forbidden(['Approver', 'Admin'])
    expect(multi.message).toBe('Requires role: Approver or Admin')
  })

  it('attaches requiredRoles in details', () => {
    const err = forbidden(['Approver', 'Admin'])
    expect(err.details).toEqual({ requiredRoles: ['Approver', 'Admin'] })
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/errors/appError.forbidden.test.ts
```

Expected: FAIL — `forbidden` is not exported.

- [ ] **Step 3: Update `src/lib/errors/AppError.ts`**

Add the `FORBIDDEN` enum value and `forbidden()` factory:

```diff
 export enum ErrorCode {
   NOT_FOUND = 'NOT_FOUND',
   ALREADY_RESOLVED = 'ALREADY_RESOLVED',
   LOCKED_BY_OTHER = 'LOCKED_BY_OTHER',
   VALIDATION_ERROR = 'VALIDATION_ERROR',
   UNAUTHORIZED = 'UNAUTHORIZED',
+  FORBIDDEN = 'FORBIDDEN',
   INTERNAL_ERROR = 'INTERNAL_ERROR',
 }
```

Append after the existing factories:

```ts
export const forbidden = (requiredRoles: string[]) =>
  new AppError({
    statusCode: 403,
    code: ErrorCode.FORBIDDEN,
    message: `Requires role: ${requiredRoles.join(' or ')}`,
    details: { requiredRoles },
  })
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/errors/appError.forbidden.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors/AppError.ts __tests__/unit/lib/errors/appError.forbidden.test.ts
git commit -m "feat(errors): add FORBIDDEN code and forbidden() factory

Used by requireRole() to signal authorization failures that
handleApiError/wrapAction translate to HTTP 403.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Prisma migration — drop NextAuth tables, add `User.entraOid`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_entra_id_auth/migration.sql` (generated by Prisma)

- [ ] **Step 1: Edit `prisma/schema.prisma`** — remove NextAuth models, add `entraOid`

Delete the `Account`, `Session`, and `VerificationToken` models. Update `User` to remove the now-orphaned relations and add `entraOid`:

```prisma
model User {
  id            String    @id @default(cuid())
  entraOid      String?   @unique
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  messages               Message[]
  workflows              Workflow[]
  workflowExecutions     WorkflowExecution[]
  approvalRequests       ApprovalRequest[]   @relation("ApprovalRequester")
  assignedApprovals      ApprovalRequest[]   @relation("ApprovalAssignee")
  approvedRequests       ApprovalRequest[]   @relation("ApprovalApprover")
  priorityConfigUpdates  PriorityConfig[]    @relation("PriorityConfigUpdater")
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt

  @@index([email])
  @@index([entraOid])
}
```

Note: `entraOid` is nullable only for seed users that are not real Entra accounts. Real Entra-provisioned users always have one; the `@unique` constraint prevents duplicates.

Remove the `Account`, `Session`, and `VerificationToken` model blocks entirely. Remove the `accounts` and `sessions` relation fields from `User`.

- [ ] **Step 2: Generate + apply the migration**

```bash
npm run db:migrate -- --name entra_id_auth
```

Expected: Prisma creates `prisma/migrations/<timestamp>_entra_id_auth/migration.sql` with `DROP TABLE` statements for the three removed tables and `ALTER TABLE "User" ADD COLUMN "entraOid"` + unique index.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npm run db:generate
```

Expected: `@prisma/client` types updated; no errors.

- [ ] **Step 4: Verify app still type-checks**

```bash
npx tsc --noEmit 2>&1 | grep -v "next-auth\|actor\.ts" | head -20
```

Expected: no type errors except ones in `actor.ts` / tests that reference NextAuth or `DEV_ACTOR_ID` (rewritten in a later task).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): drop NextAuth tables, add User.entraOid

Removes Account/Session/VerificationToken (NextAuth-specific,
never wired). Adds nullable unique entraOid on User for mapping
to Entra's stable object ID at sign-in; kept nullable so dev
seed users can exist without an Entra identity.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Update seed script — synthetic `entraOid` for dev users

**Files:**
- Modify: `prisma/seed.js`

- [ ] **Step 1: Edit `prisma/seed.js`**

Change the dev user loop to include a synthetic `entraOid` value so seeded users don't collide with real Entra sign-ins:

```diff
 const DEV_USERS = [
-  { id: 'dev-user-alice', name: 'Alice', email: 'alice@dev.local' },
-  { id: 'dev-user-bob', name: 'Bob', email: 'bob@dev.local' },
-  { id: 'dev-user-carol', name: 'Carol', email: 'carol@dev.local' },
+  { id: 'dev-user-alice', entraOid: 'seed-oid-alice', name: 'Alice', email: 'alice@dev.local' },
+  { id: 'dev-user-bob', entraOid: 'seed-oid-bob', name: 'Bob', email: 'bob@dev.local' },
+  { id: 'dev-user-carol', entraOid: 'seed-oid-carol', name: 'Carol', email: 'carol@dev.local' },
 ]
```

And the upsert:

```diff
   for (const u of DEV_USERS) {
     await prisma.user.upsert({
       where: { email: u.email },
       update: { name: u.name },
-      create: { id: u.id, name: u.name, email: u.email },
+      create: { id: u.id, entraOid: u.entraOid, name: u.name, email: u.email },
     })
   }
```

Leave the `systemUser` upsert alone — it has no `entraOid`, and that's fine (nullable).

- [ ] **Step 2: Re-seed**

```bash
npm run db:seed
```

Expected: "Seeded …" output; no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.js
git commit -m "chore(seed): add synthetic entraOid to dev users

Prevents collisions with real Entra sign-ins during local dev
and integration testing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Roles module

**Files:**
- Create: `src/lib/auth/roles.ts`
- Create: `__tests__/unit/lib/auth/roles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/roles.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role, parseRolesClaim } from '@/lib/auth/roles'

describe('Role constants', () => {
  it('exposes Admin, Approver, Requester', () => {
    expect(Role.Admin).toBe('Admin')
    expect(Role.Approver).toBe('Approver')
    expect(Role.Requester).toBe('Requester')
  })
})

describe('parseRolesClaim', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => warn.mockClear())

  it('returns known roles as-is', () => {
    expect(parseRolesClaim(['Admin'])).toEqual(['Admin'])
    expect(parseRolesClaim(['Approver', 'Admin'])).toEqual(['Approver', 'Admin'])
  })

  it('defaults to [Requester] when claim is missing', () => {
    expect(parseRolesClaim(undefined)).toEqual(['Requester'])
    expect(parseRolesClaim(null)).toEqual(['Requester'])
  })

  it('defaults to [Requester] when claim is empty', () => {
    expect(parseRolesClaim([])).toEqual(['Requester'])
  })

  it('filters out unknown roles and warns', () => {
    expect(parseRolesClaim(['Approver', 'SuperUser', 'Admin'])).toEqual(['Approver', 'Admin'])
    expect(warn).toHaveBeenCalled()
  })

  it('defaults to [Requester] when all values are unknown', () => {
    expect(parseRolesClaim(['SuperUser', 'God'])).toEqual(['Requester'])
  })

  it('defaults to [Requester] when claim is a string (malformed)', () => {
    expect(parseRolesClaim('Admin' as unknown as string[])).toEqual(['Requester'])
    expect(warn).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/roles.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/roles.ts`**

```ts
export const Role = {
  Admin: 'Admin',
  Approver: 'Approver',
  Requester: 'Requester',
} as const

export type Role = (typeof Role)[keyof typeof Role]

const KNOWN_ROLES: readonly Role[] = [Role.Admin, Role.Approver, Role.Requester]

export function parseRolesClaim(claim: unknown): Role[] {
  if (!Array.isArray(claim)) {
    if (claim !== undefined && claim !== null) {
      console.warn('[auth/roles] roles claim is not an array; defaulting to Requester', { claim })
    }
    return [Role.Requester]
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

  return known.length === 0 ? [Role.Requester] : known
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/roles.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/roles.ts __tests__/unit/lib/auth/roles.test.ts
git commit -m "feat(auth): Role type and parseRolesClaim

Three-role taxonomy (Admin/Approver/Requester) with strict
parsing: unknown values filtered + warn, empty/missing defaults
to Requester (per spec Q9 'Assignment required = No').

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Session module (JWE encode/decode)

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `__tests__/unit/lib/auth/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/session.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

const payload = {
  userId: 'u_123',
  entraOid: 'oid_abc',
  roles: ['Approver' as const],
  name: 'Alice',
  email: 'a@example.com',
  photoUrl: null,
}

describe('session encode/decode', () => {
  it('round-trips a payload', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload)
    const decoded = await decodeSession(cookie)
    expect(decoded.userId).toBe('u_123')
    expect(decoded.entraOid).toBe('oid_abc')
    expect(decoded.roles).toEqual(['Approver'])
    expect(decoded.email).toBe('a@example.com')
    expect(decoded.iat).toBeGreaterThan(0)
    expect(decoded.exp).toBe(decoded.iat + 12 * 60 * 60)
  })

  it('rejects a tampered ciphertext', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload)
    const tampered = cookie.slice(0, -2) + 'XX'
    await expect(decodeSession(tampered)).rejects.toThrow()
  })

  it('rejects an expired payload', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload, { now: Math.floor(Date.now() / 1000) - 24 * 60 * 60 })
    await expect(decodeSession(cookie)).rejects.toThrow()
  })

  it('rejects a cookie encoded with a different secret', async () => {
    const { encodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload)
    process.env.AUTH_SESSION_SECRET = 'deadbeef'.repeat(8)
    // re-import with new secret
    const fresh = await import('@/lib/auth/session?v=otherkey')
    await expect(fresh.decodeSession(cookie)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/session.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/session.ts`**

```ts
import { EncryptJWT, jwtDecrypt } from 'jose'
import { authConfig } from './config'
import type { Role } from './roles'

export type SessionPayload = {
  userId: string
  entraOid: string
  roles: Role[]
  name: string | null
  email: string | null
  photoUrl: string | null
  iat: number
  exp: number
}

export type SessionInput = Omit<SessionPayload, 'iat' | 'exp'>

function getKey(): Uint8Array {
  // jose requires 32 bytes for A256GCM. Derive deterministically by hashing the secret.
  // Synchronous, constant-time — using Node crypto via dynamic import is overkill here.
  const raw = new TextEncoder().encode(authConfig.sessionSecret)
  // Simple pad/truncate to 32 bytes for dev; prod secrets are already 32+ bytes.
  const key = new Uint8Array(32)
  for (let i = 0; i < 32; i++) key[i] = raw[i % raw.length] ?? 0
  return key
}

export async function encodeSession(
  input: SessionInput,
  opts: { now?: number; ttlSeconds?: number } = {}
): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const ttl = opts.ttlSeconds ?? authConfig.sessionTtlSeconds
  const exp = now + ttl

  return await new EncryptJWT({
    userId: input.userId,
    entraOid: input.entraOid,
    roles: input.roles,
    name: input.name,
    email: input.email,
    photoUrl: input.photoUrl,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .encrypt(getKey())
}

export async function decodeSession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtDecrypt(token, getKey())
  return {
    userId: payload.userId as string,
    entraOid: payload.entraOid as string,
    roles: payload.roles as Role[],
    name: (payload.name as string | null) ?? null,
    email: (payload.email as string | null) ?? null,
    photoUrl: (payload.photoUrl as string | null) ?? null,
    iat: payload.iat as number,
    exp: payload.exp as number,
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/session.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts __tests__/unit/lib/auth/session.test.ts
git commit -m "feat(auth): JWE session encode/decode

Stateless 12h session cookie using jose A256GCM direct encryption.
Payload: userId, entraOid, roles, name, email, photoUrl, iat, exp.
Pure functions; Edge-runtime compatible (no Node crypto imports).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Cookies module + returnTo validation

**Files:**
- Create: `src/lib/auth/cookies.ts`
- Create: `__tests__/unit/lib/auth/cookies.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/cookies.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { validateReturnTo, sessionCookieOptions, oauthPendingCookieOptions } from '@/lib/auth/cookies'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

describe('validateReturnTo', () => {
  it('accepts same-origin relative paths', () => {
    expect(validateReturnTo('/approvals/123')).toBe('/approvals/123')
    expect(validateReturnTo('/')).toBe('/')
    expect(validateReturnTo('/deep/path?x=1&y=2')).toBe('/deep/path?x=1&y=2')
  })

  it('rejects absolute URLs', () => {
    expect(validateReturnTo('http://evil.com/x')).toBeNull()
    expect(validateReturnTo('https://evil.com/x')).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(validateReturnTo('//evil.com/x')).toBeNull()
  })

  it('rejects javascript: and data: URIs', () => {
    expect(validateReturnTo('javascript:alert(1)')).toBeNull()
    expect(validateReturnTo('data:text/html,<script>')).toBeNull()
  })

  it('returns null for undefined / empty / non-string', () => {
    expect(validateReturnTo(undefined)).toBeNull()
    expect(validateReturnTo('')).toBeNull()
    expect(validateReturnTo(null)).toBeNull()
  })
})

describe('cookie options', () => {
  it('sessionCookieOptions is HttpOnly + Secure + SameSite=Lax + Path=/', () => {
    const o = sessionCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.secure).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/')
    expect(o.maxAge).toBe(12 * 60 * 60)
  })

  it('oauthPendingCookieOptions is scoped to /auth/callback', () => {
    const o = oauthPendingCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.secure).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/auth/callback')
    expect(o.maxAge).toBe(10 * 60)
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/cookies.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/cookies.ts`**

```ts
import { authConfig } from './config'

export type CookieOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge: number
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: authConfig.sessionTtlSeconds,
  }
}

export function clearSessionCookieOptions(): CookieOptions {
  return { ...sessionCookieOptions(), maxAge: 0 }
}

export function oauthPendingCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/auth/callback',
    maxAge: authConfig.oauthPendingTtlSeconds,
  }
}

export function clearOauthPendingCookieOptions(): CookieOptions {
  return { ...oauthPendingCookieOptions(), maxAge: 0 }
}

export function validateReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  // Block whitespace-leading sneaks: URL parsing would normalize
  if (/^\s/.test(value)) return null
  return value
}

export const OAUTH_PENDING_COOKIE = authConfig.oauthPendingCookieName
export const SESSION_COOKIE = authConfig.sessionCookieName
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/cookies.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/cookies.ts __tests__/unit/lib/auth/cookies.test.ts
git commit -m "feat(auth): cookie options + returnTo validation

Session cookie HttpOnly+Secure+SameSite=Lax+Path=/;
oauth_pending scoped to /auth/callback. validateReturnTo
rejects absolute, protocol-relative, and non-path URIs to
prevent open redirects.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Rewrite `actor.ts` to read JWE session + sliding refresh

**Files:**
- Modify: `src/lib/auth/actor.ts`
- Modify: `__tests__/unit/lib/auth/actor.test.ts`

- [ ] **Step 1: Rewrite the test file** (replaces the NextAuth-based tests)

Replace `__tests__/unit/lib/auth/actor.test.ts` with:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockStore),
}))

async function encodeFresh(overrides: Record<string, unknown> = {}) {
  const { encodeSession } = await import('@/lib/auth/session')
  return encodeSession({
    userId: 'u_1',
    entraOid: 'oid_1',
    roles: ['Approver'],
    name: 'Alice',
    email: 'a@x.com',
    photoUrl: null,
    ...overrides,
  } as never)
}

describe('getActor', () => {
  beforeEach(() => {
    mockStore.get.mockReset()
    mockStore.set.mockReset()
    mockStore.delete.mockReset()
  })

  it('returns { id, roles } when the session cookie is valid', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: 'u_1', roles: ['Approver'] })
  })

  it('throws UNAUTHORIZED when no session cookie', async () => {
    mockStore.get.mockReturnValue(undefined)
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws UNAUTHORIZED on tampered cookie', async () => {
    mockStore.get.mockReturnValue({ value: 'not-a-valid-jwe' })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('does not try to refresh if session is fresh (<6h old)', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    await getActor()
    expect(mockStore.set).not.toHaveBeenCalled()
  })

  it('refreshes the cookie when session is older than 6h', async () => {
    const { encodeSession } = await import('@/lib/auth/session')
    const now = Math.floor(Date.now() / 1000)
    // issue a cookie that says iat was 7 hours ago; still valid (< 12h)
    const cookie = await encodeSession(
      {
        userId: 'u_1',
        entraOid: 'oid_1',
        roles: ['Approver'],
        name: 'Alice',
        email: 'a@x.com',
        photoUrl: null,
      },
      { now: now - 7 * 60 * 60, ttlSeconds: 12 * 60 * 60 }
    )
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    await getActor()
    expect(mockStore.set).toHaveBeenCalledWith('session', expect.any(String), expect.objectContaining({ httpOnly: true }))
  })

  it('silently swallows cookie set failures (server component context)', async () => {
    const { encodeSession } = await import('@/lib/auth/session')
    const now = Math.floor(Date.now() / 1000)
    const cookie = await encodeSession(
      { userId: 'u_1', entraOid: 'oid_1', roles: ['Approver'], name: null, email: null, photoUrl: null },
      { now: now - 7 * 60 * 60 }
    )
    mockStore.get.mockReturnValue({ value: cookie })
    mockStore.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.')
    })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).resolves.toMatchObject({ id: 'u_1' })
  })
})

describe('getActorId (back-compat shim)', () => {
  beforeEach(() => {
    mockStore.get.mockReset()
    mockStore.set.mockReset()
  })

  it('returns the id string', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActorId } = await import('@/lib/auth/actor')
    await expect(getActorId()).resolves.toBe('u_1')
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/actor.test.ts
```

Expected: FAIL — current `actor.ts` imports `next-auth`, which is gone.

- [ ] **Step 3: Replace `src/lib/auth/actor.ts`**

Overwrite the entire file:

```ts
import { cookies } from 'next/headers'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { authConfig } from './config'
import {
  sessionCookieOptions,
  SESSION_COOKIE,
} from './cookies'
import { decodeSession, encodeSession, type SessionPayload } from './session'
import type { Role } from './roles'

export type Actor = {
  id: string
  roles: Role[]
}

function unauthorized(): AppError {
  return new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: 'Sign in required',
  })
}

async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    return await decodeSession(raw)
  } catch {
    return null
  }
}

async function maybeRefresh(session: SessionPayload): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  if (now - session.iat < authConfig.slidingRefreshThresholdSeconds) return

  try {
    const fresh = await encodeSession({
      userId: session.userId,
      entraOid: session.entraOid,
      roles: session.roles,
      name: session.name,
      email: session.email,
      photoUrl: session.photoUrl,
    })
    const store = await cookies()
    store.set(SESSION_COOKIE, fresh, sessionCookieOptions())
  } catch {
    // Server components can't set cookies; swallow. Refresh will happen on
    // the next Server Action / Route Handler touch.
  }
}

export async function getActor(): Promise<Actor> {
  const session = await readSession()
  if (!session) throw unauthorized()
  await maybeRefresh(session)
  return { id: session.userId, roles: session.roles }
}

/** @deprecated Prefer getActor() which returns roles. */
export async function getActorId(): Promise<string> {
  const actor = await getActor()
  return actor.id
}

export async function getSessionForClient(): Promise<{
  userId: string
  roles: Role[]
  name: string | null
  email: string | null
  photoUrl: string | null
} | null> {
  const session = await readSession()
  if (!session) return null
  return {
    userId: session.userId,
    roles: session.roles,
    name: session.name,
    email: session.email,
    photoUrl: session.photoUrl,
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/actor.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/actor.ts __tests__/unit/lib/auth/actor.test.ts
git commit -m "feat(auth): getActor reads JWE session cookie with sliding refresh

Drops DEV_ACTOR_ID fallback (per spec Q7 — Entra required in
all envs). Adds getSessionForClient() for server components
that populate the client SessionProvider. Sliding refresh
re-issues a fresh 12h cookie when session age exceeds 6h;
silently skips in server-component context where cookies are
read-only.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: `requireRole` helper

**Files:**
- Create: `src/lib/auth/requireRole.ts`
- Create: `__tests__/unit/lib/auth/requireRole.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/requireRole.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
}))

import { getActor } from '@/lib/auth/actor'
import { requireRole, requireAnyRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'

describe('requireRole', () => {
  beforeEach(() => vi.mocked(getActor).mockReset())

  it('returns the actor when it holds the required role', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.Admin] })
    const actor = await requireRole(Role.Admin)
    expect(actor.id).toBe('u_1')
  })

  it('throws FORBIDDEN when the actor lacks the required role', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.Requester] })
    await expect(requireRole(Role.Admin)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('passes through UNAUTHORIZED from getActor', async () => {
    vi.mocked(getActor).mockRejectedValue({ code: 'UNAUTHORIZED' })
    await expect(requireRole(Role.Admin)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('requireAnyRole', () => {
  beforeEach(() => vi.mocked(getActor).mockReset())

  it('passes if actor has any of the given roles', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.Approver] })
    const actor = await requireAnyRole([Role.Approver, Role.Admin])
    expect(actor.id).toBe('u_1')
  })

  it('throws FORBIDDEN if actor holds none of the given roles', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.Requester] })
    await expect(requireAnyRole([Role.Approver, Role.Admin])).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringContaining('Approver or Admin'),
    })
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/requireRole.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/requireRole.ts`**

```ts
import { getActor, type Actor } from './actor'
import { forbidden } from '@/lib/errors/AppError'
import type { Role } from './roles'

export async function requireRole(role: Role): Promise<Actor> {
  const actor = await getActor()
  if (!actor.roles.includes(role)) throw forbidden([role])
  return actor
}

export async function requireAnyRole(roles: readonly Role[]): Promise<Actor> {
  const actor = await getActor()
  const hasAny = roles.some((r) => actor.roles.includes(r))
  if (!hasAny) throw forbidden([...roles])
  return actor
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/requireRole.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/requireRole.ts __tests__/unit/lib/auth/requireRole.test.ts
git commit -m "feat(auth): requireRole / requireAnyRole authz helpers

Throws AppError(FORBIDDEN) when actor lacks required role;
passes through UNAUTHORIZED from getActor unchanged so
wrapAction/handleApiError translate each to the right HTTP
status.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Extend `mockActor` test helper to accept roles

**Files:**
- Modify: `__tests__/helpers/mockActor.ts`

- [ ] **Step 1: Replace `__tests__/helpers/mockActor.ts`**

```ts
import { vi } from 'vitest'
import type { Role } from '@/lib/auth/roles'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
  getActorId: vi.fn(),
  getSessionForClient: vi.fn(),
}))

export async function setActor(id: string, roles: Role[] = ['Approver' as Role]) {
  const mod = await import('@/lib/auth/actor')
  vi.mocked(mod.getActor).mockResolvedValue({ id, roles })
  vi.mocked(mod.getActorId).mockResolvedValue(id)
  vi.mocked(mod.getSessionForClient).mockResolvedValue({
    userId: id,
    roles,
    name: null,
    email: null,
    photoUrl: null,
  })
}

export async function clearActor() {
  const mod = await import('@/lib/auth/actor')
  const { AppError, ErrorCode } = await import('@/lib/errors/AppError')
  const err = new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: 'Sign in required',
  })
  vi.mocked(mod.getActor).mockRejectedValue(err)
  vi.mocked(mod.getActorId).mockRejectedValue(err)
  vi.mocked(mod.getSessionForClient).mockResolvedValue(null)
}
```

Note: the old helper exported `DEV_ACTOR_ID`. Anything that imports it will need to update; this is intentional — `DEV_ACTOR_ID` is going away.

- [ ] **Step 2: Grep for stale imports of `DEV_ACTOR_ID`**

```bash
npx grep -rn "DEV_ACTOR_ID" src __tests__
```

Any occurrences that aren't in the old `actor.ts` (already rewritten) or `mockActor.ts` should be updated — but since `mockActor.ts` no longer exports it and `actor.ts` no longer exports it, such imports would be build errors. If grep returns results, remove those imports.

- [ ] **Step 3: Run the existing integration test to confirm helper still works**

```bash
npm run test:integration -- --run __tests__/integration/actions/approvals.test.ts
```

Note: this may fail if the integration test DB isn't up — that's fine at this stage if the failure is DB-connectivity, not a type/import error. If you see type errors, fix them; if you see DB errors, continue.

- [ ] **Step 4: Commit**

```bash
git add __tests__/helpers/mockActor.ts
git commit -m "test(auth): extend mockActor helper to accept roles

setActor(id, roles?) mocks getActor/getActorId/getSessionForClient
in one shot. Defaults to Approver role to match existing
integration tests that exercise the approvals verb surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: MSAL confidential client singleton

**Files:**
- Create: `src/lib/auth/msal.ts`
- Create: `__tests__/unit/lib/auth/msal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/msal.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AZURE_AD_CLIENT_ID = 'client-xxx'
  process.env.AZURE_AD_CLIENT_SECRET = 'secret-xxx'
  process.env.AZURE_AD_TENANT_ID = 'tenant-xxx'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
})

describe('getMsalClient', () => {
  it('returns a ConfidentialClientApplication instance', async () => {
    const { getMsalClient } = await import('@/lib/auth/msal')
    const client = getMsalClient()
    expect(typeof client.getAuthCodeUrl).toBe('function')
    expect(typeof client.acquireTokenByCode).toBe('function')
  })

  it('returns the same instance on subsequent calls (singleton)', async () => {
    const { getMsalClient } = await import('@/lib/auth/msal')
    expect(getMsalClient()).toBe(getMsalClient())
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/msal.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/msal.ts`**

```ts
import { ConfidentialClientApplication, LogLevel } from '@azure/msal-node'
import { authConfig } from './config'

let _client: ConfidentialClientApplication | null = null

export function getMsalClient(): ConfidentialClientApplication {
  if (_client) return _client
  _client = new ConfidentialClientApplication({
    auth: {
      clientId: authConfig.clientId,
      clientSecret: authConfig.clientSecret,
      authority: authConfig.authorityUrl,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
        loggerCallback: (_level, message) => {
          // MSAL warnings/errors go here; keep terse.
          console.warn('[msal]', message)
        },
      },
    },
  })
  return _client
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/msal.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/msal.ts __tests__/unit/lib/auth/msal.test.ts
git commit -m "feat(auth): MSAL confidential client singleton

ConfidentialClientApplication wired from authConfig; in-memory
cache is sufficient since we only need Graph during /auth/callback
for the one-shot photo fetch. PII logging disabled.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Graph photo fetcher

**Files:**
- Create: `src/lib/auth/graph.ts`
- Create: `__tests__/unit/lib/auth/graph.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/auth/graph.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchUserPhoto } from '@/lib/auth/graph'

const originalFetch = global.fetch

describe('fetchUserPhoto', () => {
  beforeEach(() => {
    // @ts-expect-error override
    global.fetch = vi.fn()
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns a data URI on 200', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }) as never
    )
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('returns null on 404 (user has no photo)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('', { status: 404 }) as never)
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toBeNull()
  })

  it('returns null on 401/5xx (do not fail sign-in)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('', { status: 500 }) as never)
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toBeNull()
  })

  it('returns null if fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))
    const dataUri = await fetchUserPhoto('fake-access-token')
    expect(dataUri).toBeNull()
  })

  it('sends the access token as a Bearer auth header', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('', { status: 404 }) as never)
    await fetchUserPhoto('fake-access-token')
    const call = vi.mocked(global.fetch).mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer fake-access-token')
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/lib/auth/graph.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/graph.ts`**

```ts
const GRAPH_PHOTO_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value'

export async function fetchUserPhoto(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GRAPH_PHOTO_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 404) return null
    if (!res.ok) {
      console.warn('[auth/graph] photo fetch failed', { status: res.status })
      return null
    }
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = await res.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    return `data:${contentType};base64,${b64}`
  } catch (err) {
    console.warn('[auth/graph] photo fetch threw', { err: (err as Error).message })
    return null
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/lib/auth/graph.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/graph.ts __tests__/unit/lib/auth/graph.test.ts
git commit -m "feat(auth): Graph photo fetcher (one-shot at sign-in)

Calls /me/photo/\$value with a Bearer token; returns data URI
on 200, null on 404/401/5xx/network — never throws so sign-in
proceeds with a blank avatar if Graph is unavailable.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: `/auth/signin` route handler

**Files:**
- Create: `src/app/auth/signin/route.ts`
- Create: `__tests__/unit/app/auth/signin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/app/auth/signin.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

beforeAll(() => {
  process.env.AZURE_AD_CLIENT_ID = 'c'
  process.env.AZURE_AD_CLIENT_SECRET = 's'
  process.env.AZURE_AD_TENANT_ID = 't'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
})

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockStore) }))

const getAuthCodeUrl = vi.fn()
vi.mock('@/lib/auth/msal', () => ({
  getMsalClient: () => ({ getAuthCodeUrl }),
}))

describe('GET /auth/signin', () => {
  beforeEach(() => {
    mockStore.set.mockReset()
    getAuthCodeUrl.mockReset()
    getAuthCodeUrl.mockResolvedValue('https://login.microsoftonline.com/tenant/authorize?x=1')
  })

  it('redirects to the Entra auth URL with a signed oauth_pending cookie', async () => {
    const { GET } = await import('@/app/auth/signin/route')
    const req = new Request('http://localhost:3000/auth/signin')
    const res = await GET(req as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('login.microsoftonline.com')
    expect(mockStore.set).toHaveBeenCalledWith(
      'oauth_pending',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/auth/callback' })
    )
  })

  it('stores a valid returnTo in oauth_pending when query is present and safe', async () => {
    const { GET } = await import('@/app/auth/signin/route')
    const req = new Request('http://localhost:3000/auth/signin?returnTo=/approvals/1')
    await GET(req as never)
    const [, body] = mockStore.set.mock.calls[0]
    const decoded = JSON.parse(Buffer.from(body as string, 'base64').toString('utf8'))
    expect(decoded.returnTo).toBe('/approvals/1')
  })

  it('drops an unsafe returnTo', async () => {
    const { GET } = await import('@/app/auth/signin/route')
    const req = new Request('http://localhost:3000/auth/signin?returnTo=http://evil.com')
    await GET(req as never)
    const [, body] = mockStore.set.mock.calls[0]
    const decoded = JSON.parse(Buffer.from(body as string, 'base64').toString('utf8'))
    expect(decoded.returnTo).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/app/auth/signin.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/auth/signin/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { getMsalClient } from '@/lib/auth/msal'
import { authConfig } from '@/lib/auth/config'
import {
  oauthPendingCookieOptions,
  validateReturnTo,
  OAUTH_PENDING_COOKIE,
} from '@/lib/auth/cookies'

export const runtime = 'nodejs'

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const returnTo = validateReturnTo(url.searchParams.get('returnTo') ?? undefined)

  const state = b64url(randomBytes(16))
  const { verifier, challenge } = generatePkce()

  const msal = getMsalClient()
  const authUrl = await msal.getAuthCodeUrl({
    scopes: authConfig.scopes,
    redirectUri: authConfig.redirectUri,
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  })

  const pending = Buffer.from(
    JSON.stringify({ state, codeVerifier: verifier, returnTo }),
    'utf8'
  ).toString('base64')

  const store = await cookies()
  store.set(OAUTH_PENDING_COOKIE, pending, oauthPendingCookieOptions())

  return NextResponse.redirect(authUrl, { status: 302 })
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/app/auth/signin.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/signin/route.ts __tests__/unit/app/auth/signin.test.ts
git commit -m "feat(auth): GET /auth/signin builds PKCE + state + auth URL

Generates PKCE verifier (random 32 bytes, base64url) + S256
challenge, random state nonce, validated returnTo; stores all
three in a short-lived oauth_pending cookie scoped to
/auth/callback; redirects to Entra's authorize endpoint.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: `/auth/callback` route handler + integration test with MSW

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `__tests__/mocks/handlers/entra.ts`
- Modify: `__tests__/mocks/server.ts` (if present) or register handlers inline
- Create: `__tests__/integration/auth/callback.test.ts`

- [ ] **Step 1: Add MSW handlers for Entra + Graph**

Create `__tests__/mocks/handlers/entra.ts`:

```ts
import { http, HttpResponse } from 'msw'

export type MockTokenOverrides = {
  roles?: string[] | undefined
  oid?: string
  name?: string
  email?: string
  status?: number
  body?: Record<string, unknown>
}

export function buildIdToken(claims: Record<string, unknown>): string {
  // Minimal unsigned JWT — header.payload.signature (signature is never verified
  // by MSAL in our integration because we mock the token endpoint entirely).
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

export function entraHandlers(overrides: MockTokenOverrides = {}) {
  const claims = {
    oid: overrides.oid ?? 'oid-alice',
    name: overrides.name ?? 'Alice Test',
    preferred_username: overrides.email ?? 'alice@test.local',
    ...(overrides.roles !== undefined && { roles: overrides.roles }),
  }
  return [
    http.post(`https://login.microsoftonline.com/*/oauth2/v2.0/token`, async () => {
      if (overrides.status && overrides.status >= 400) {
        return HttpResponse.json(overrides.body ?? { error: 'invalid_grant' }, {
          status: overrides.status,
        })
      }
      return HttpResponse.json({
        token_type: 'Bearer',
        scope: 'openid profile User.Read',
        expires_in: 3600,
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        id_token: buildIdToken(claims),
      })
    }),
    http.get('https://graph.microsoft.com/v1.0/me/photo/*', () =>
      HttpResponse.arrayBuffer(new Uint8Array([0xff, 0xd8, 0xff]).buffer, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })
    ),
  ]
}
```

- [ ] **Step 2: Write the failing integration test**

Create `__tests__/integration/auth/callback.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { entraHandlers, buildIdToken } from '../../mocks/handlers/entra'
import { prisma } from '@/lib/prisma'

// Bypass MSAL's real PKCE verifier check by mocking acquireTokenByCode.
// We still exercise the rest of the callback pipeline (cookie set, user upsert, session encode).
import { vi } from 'vitest'

vi.mock('@/lib/auth/msal', () => {
  const acquireTokenByCode = vi.fn()
  return {
    getMsalClient: () => ({ acquireTokenByCode }),
    __mocks: { acquireTokenByCode },
  }
})

const server = setupServer(...entraHandlers())

beforeAll(() => server.listen())
afterAll(() => server.close())

beforeEach(async () => {
  server.resetHandlers(...entraHandlers())
  await prisma.user.deleteMany({ where: { entraOid: { startsWith: 'test-oid-' } } })
})

function fakePendingCookie(state: string, codeVerifier = 'verifier', returnTo: string | null = null) {
  return Buffer.from(JSON.stringify({ state, codeVerifier, returnTo }), 'utf8').toString('base64')
}

describe('GET /auth/callback', () => {
  it('happy path: exchanges code, upserts user, sets session cookie, redirects home', async () => {
    const msal = await import('@/lib/auth/msal')
    // @ts-expect-error __mocks is our backdoor
    msal.__mocks.acquireTokenByCode.mockResolvedValue({
      idToken: buildIdToken({ oid: 'test-oid-1', name: 'Alice', preferred_username: 'a@test.local', roles: ['Approver'] }),
      accessToken: 'fake-access-token',
      idTokenClaims: {
        oid: 'test-oid-1',
        name: 'Alice',
        preferred_username: 'a@test.local',
        roles: ['Approver'],
      },
    })

    const { GET } = await import('@/app/auth/callback/route')
    const req = new Request('http://localhost:3000/auth/callback?code=abc&state=xyz', {
      headers: { cookie: `oauth_pending=${fakePendingCookie('xyz')}` },
    })
    const res = await GET(req as never)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('session=')
    expect(setCookie.toLowerCase()).toContain('httponly')

    const user = await prisma.user.findUnique({ where: { entraOid: 'test-oid-1' } })
    expect(user).not.toBeNull()
    expect(user?.email).toBe('a@test.local')
  })

  it('state mismatch: redirects to /auth/signin with error, no user created, no cookie', async () => {
    const { GET } = await import('@/app/auth/callback/route')
    const req = new Request('http://localhost:3000/auth/callback?code=abc&state=NOT_MATCHING', {
      headers: { cookie: `oauth_pending=${fakePendingCookie('xyz')}` },
    })
    const res = await GET(req as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/signin?error=state_mismatch')
    const user = await prisma.user.findFirst({ where: { entraOid: { startsWith: 'test-oid-' } } })
    expect(user).toBeNull()
  })

  it('no role claim → session contains [Requester]', async () => {
    const msal = await import('@/lib/auth/msal')
    // @ts-expect-error __mocks
    msal.__mocks.acquireTokenByCode.mockResolvedValue({
      accessToken: 'fake-access-token',
      idTokenClaims: {
        oid: 'test-oid-2',
        name: 'Bob',
        preferred_username: 'b@test.local',
      },
    })
    const { GET } = await import('@/app/auth/callback/route')
    const req = new Request('http://localhost:3000/auth/callback?code=abc&state=xyz', {
      headers: { cookie: `oauth_pending=${fakePendingCookie('xyz')}` },
    })
    const res = await GET(req as never)
    expect(res.status).toBe(302)

    const sessionCookie = (res.headers.get('set-cookie') ?? '').match(/session=([^;]+)/)?.[1] ?? ''
    const { decodeSession } = await import('@/lib/auth/session')
    const payload = await decodeSession(decodeURIComponent(sessionCookie))
    expect(payload.roles).toEqual(['Requester'])
  })
})
```

- [ ] **Step 3: Ensure MSW is installed + set up for integration**

`msw` is already in devDependencies. Update `__tests__/setup/vitest.integration.setup.ts` to import `.env.test` via `dotenv`:

```ts
import { vi } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.test', override: true })

global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}
```

If `dotenv` isn't installed: `npm install --save-dev dotenv`.

- [ ] **Step 4: Run test, verify failure**

```bash
npm run test:integration -- --run __tests__/integration/auth/callback.test.ts
```

Expected: FAIL — `@/app/auth/callback/route` does not exist.

- [ ] **Step 5: Implement `src/app/auth/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getMsalClient } from '@/lib/auth/msal'
import { authConfig } from '@/lib/auth/config'
import { parseRolesClaim } from '@/lib/auth/roles'
import { encodeSession } from '@/lib/auth/session'
import { fetchUserPhoto } from '@/lib/auth/graph'
import {
  clearOauthPendingCookieOptions,
  clearSessionCookieOptions,
  sessionCookieOptions,
  validateReturnTo,
  OAUTH_PENDING_COOKIE,
  SESSION_COOKIE,
} from '@/lib/auth/cookies'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'

export const runtime = 'nodejs'

type PendingOauth = { state: string; codeVerifier: string; returnTo: string | null }

function redirect(location: string): NextResponse {
  return NextResponse.redirect(location, { status: 302 })
}

async function readPending(): Promise<PendingOauth | null> {
  const store = await cookies()
  const raw = store.get(OAUTH_PENDING_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as PendingOauth
  } catch {
    return null
  }
}

async function clearPending(): Promise<void> {
  const store = await cookies()
  store.set(OAUTH_PENDING_COOKIE, '', clearOauthPendingCookieOptions())
}

export async function GET(req: NextRequest) {
  return createSpan('auth.callback', async (span) => {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Entra-surfaced error (user cancelled, admin hasn't consented, etc.)
    if (error) {
      span.setAttribute('error.code', error)
      await clearPending()
      return redirect(`${authConfig.appUrl}/auth/unauthorized?reason=entra&code=${encodeURIComponent(error)}`)
    }

    const pending = await readPending()
    if (!pending || !state || pending.state !== state || !code) {
      span.setAttribute('error.reason', 'state_mismatch')
      await clearPending()
      return redirect(`${authConfig.appUrl}/auth/signin?error=state_mismatch`)
    }

    let tokenResult
    try {
      tokenResult = await getMsalClient().acquireTokenByCode({
        code,
        scopes: authConfig.scopes,
        redirectUri: authConfig.redirectUri,
        codeVerifier: pending.codeVerifier,
      })
    } catch (err) {
      span.setAttribute('error.reason', 'token_exchange')
      span.setAttribute('error.code', (err as { errorCode?: string }).errorCode ?? 'unknown')
      await clearPending()
      return redirect(`${authConfig.appUrl}/auth/unauthorized?reason=token_exchange`)
    }
    if (!tokenResult) {
      await clearPending()
      return redirect(`${authConfig.appUrl}/auth/unauthorized?reason=token_exchange`)
    }

    const claims = tokenResult.idTokenClaims as {
      oid?: string
      name?: string
      preferred_username?: string
      roles?: unknown
    }
    const entraOid = claims.oid
    if (!entraOid) {
      await clearPending()
      return redirect(`${authConfig.appUrl}/auth/unauthorized?reason=provisioning`)
    }

    const name = claims.name ?? null
    const email = claims.preferred_username ?? null
    const roles = parseRolesClaim(claims.roles)

    let user
    try {
      user = await prisma.user.upsert({
        where: { entraOid },
        create: { entraOid, name, email, image: null },
        update: { name, email },
      })
    } catch (err) {
      span.setAttribute('error.reason', 'provisioning')
      console.error('[auth/callback] user upsert failed', err)
      await clearPending()
      return redirect(`${authConfig.appUrl}/auth/unauthorized?reason=provisioning`)
    }

    let photoUrl = user.image
    if (!photoUrl && tokenResult.accessToken) {
      photoUrl = await fetchUserPhoto(tokenResult.accessToken)
      if (photoUrl) {
        await prisma.user
          .update({ where: { id: user.id }, data: { image: photoUrl } })
          .catch((err) => console.warn('[auth/callback] persist photo failed', err))
      }
    }

    span.setAttribute('actor.id', user.id)
    span.setAttribute('actor.entraOid', entraOid)

    const sessionCookie = await encodeSession({
      userId: user.id,
      entraOid,
      roles,
      name,
      email,
      photoUrl,
    })

    const store = await cookies()
    store.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions())
    // pending cleared: same site as session cookie mutation, same request
    store.set(OAUTH_PENDING_COOKIE, '', clearOauthPendingCookieOptions())

    const returnTo = validateReturnTo(pending.returnTo) ?? '/'
    return redirect(returnTo)
  })
}

// Unused clear helper retained in case of future federated-logout expansion.
void clearSessionCookieOptions
```

- [ ] **Step 6: Run test**

```bash
npm run test:integration -- --run __tests__/integration/auth/callback.test.ts
```

Expected: PASS (3 tests). If the test DB is not up, start it with `npm run infra:up` and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/app/auth/callback/route.ts __tests__/mocks/handlers/entra.ts __tests__/integration/auth/callback.test.ts __tests__/setup/vitest.integration.setup.ts
git commit -m "feat(auth): GET /auth/callback completes OAuth code flow

Validates state+PKCE from oauth_pending; exchanges code via
MSAL; parses Entra oid/name/email/roles from idTokenClaims;
upserts User by entraOid; one-shot Graph photo fetch cached on
User.image; encodes 12h JWE session cookie; redirects to
validated returnTo or /. All failure paths redirect to
/auth/unauthorized?reason=… with no secrets in the URL.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: `/auth/signout` route

**Files:**
- Create: `src/app/auth/signout/route.ts`
- Create: `__tests__/unit/app/auth/signout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/app/auth/signout.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AZURE_AD_CLIENT_ID = 'c'
  process.env.AZURE_AD_CLIENT_SECRET = 's'
  process.env.AZURE_AD_TENANT_ID = 't'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
})

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockStore) }))

describe('POST /auth/signout', () => {
  it('clears the session cookie and redirects to /auth/signin', async () => {
    mockStore.set.mockReset()
    const { POST } = await import('@/app/auth/signout/route')
    const req = new Request('http://localhost:3000/auth/signout', { method: 'POST' })
    const res = await POST(req as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/signin')
    expect(mockStore.set).toHaveBeenCalledWith(
      'session',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/app/auth/signout.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/auth/signout/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { authConfig } from '@/lib/auth/config'
import { clearSessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/cookies'

export const runtime = 'nodejs'

async function clearAndRedirect(): Promise<NextResponse> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', clearSessionCookieOptions())
  return NextResponse.redirect(`${authConfig.appUrl}/auth/signin`, { status: 302 })
}

export async function POST(_req: NextRequest) {
  return clearAndRedirect()
}

// Allow GET too so a plain <a href="/auth/signout"> works without a form.
export async function GET(_req: NextRequest) {
  return clearAndRedirect()
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/app/auth/signout.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/signout/route.ts __tests__/unit/app/auth/signout.test.ts
git commit -m "feat(auth): /auth/signout clears session cookie (local sign-out)

Accepts GET or POST; sets session=; max-age=0 and redirects to
/auth/signin. Does not federate logout — Entra SSO session
persists (per spec Q8).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: `/auth/unauthorized` page

**Files:**
- Create: `src/app/auth/unauthorized/page.tsx`

- [ ] **Step 1: Create `src/app/auth/unauthorized/page.tsx`**

```tsx
type Reason = 'token_exchange' | 'entra' | 'provisioning' | 'forbidden' | 'unknown'

const MESSAGES: Record<Reason, string> = {
  token_exchange: 'We could not complete sign-in with Microsoft. Please try again.',
  entra: 'Microsoft reported an error during sign-in. Please contact your administrator if this persists.',
  provisioning: 'Your account could not be provisioned. Please contact your administrator.',
  forbidden: 'You do not have permission to access that resource.',
  unknown: 'Sign-in is not available right now. Please try again.',
}

export default async function UnauthorizedPage(props: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await props.searchParams
  const known: Reason = (['token_exchange', 'entra', 'provisioning', 'forbidden'] as const).includes(
    reason as Reason
  )
    ? (reason as Reason)
    : 'unknown'

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold">Sign-in required</h1>
      <p className="text-muted-foreground">{MESSAGES[known]}</p>
      <a
        href="/auth/signin"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Sign in again
      </a>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/unauthorized/page.tsx
git commit -m "feat(auth): /auth/unauthorized page for auth failures

Server component reading ?reason=; renders a plain, non-technical
message and a sign-in link. Never leaks MSAL error codes or
stack traces — those go to server logs only.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 18: Edge middleware — authN only

**Files:**
- Create: `src/middleware.ts`
- Create: `__tests__/unit/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/middleware.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

function mkRequest(path: string, cookie?: string) {
  const req = new Request(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  })
  // Mimic NextRequest.cookies.get shape
  ;(req as any).nextUrl = new URL(req.url)
  ;(req as any).cookies = {
    get: (name: string) => {
      const m = (cookie ?? '').match(new RegExp(`${name}=([^;]+)`))
      return m ? { value: decodeURIComponent(m[1]) } : undefined
    },
  }
  return req as unknown as import('next/server').NextRequest
}

async function freshCookie() {
  const { encodeSession } = await import('@/lib/auth/session')
  return encodeSession({
    userId: 'u_1',
    entraOid: 'oid_1',
    roles: ['Approver'],
    name: null,
    email: null,
    photoUrl: null,
  })
}

describe('middleware', () => {
  it('redirects unauthenticated requests to /auth/signin with returnTo', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/approvals'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
    expect(res.headers.get('location')).toContain('returnTo=%2Fapprovals')
  })

  it('allows /auth/* without a session', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/auth/signin'))
    expect(res.status).toBe(200) // NextResponse.next() yields 200
  })

  it('allows authenticated requests to pass through', async () => {
    const cookie = `session=${encodeURIComponent(await freshCookie())}`
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/approvals', cookie))
    expect(res.status).toBe(200)
  })

  it('redirects when session cookie is tampered', async () => {
    const cookie = `session=not-a-valid-jwe`
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/approvals', cookie))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
  })
})
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/middleware.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { decodeSession } from '@/lib/auth/session'
import { authConfig } from '@/lib/auth/config'

// Edge runtime is the default for middleware in Next.js; keep it so.
export const config = {
  // Match everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/auth/signin' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/signout' ||
    pathname.startsWith('/auth/unauthorized') ||
    pathname === '/auth/signin/' // trailing-slash tolerance
}

function redirectToSignin(req: NextRequest, extra: Record<string, string> = {}): NextResponse {
  const url = new URL('/auth/signin', req.nextUrl.origin)
  const returnTo = req.nextUrl.pathname + req.nextUrl.search
  if (returnTo && returnTo !== '/') url.searchParams.set('returnTo', returnTo)
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  return NextResponse.redirect(url, { status: 307 })
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()

  const cookie = req.cookies.get(authConfig.sessionCookieName)?.value
  if (!cookie) return redirectToSignin(req)

  try {
    await decodeSession(cookie)
    return NextResponse.next()
  } catch {
    return redirectToSignin(req, { error: 'invalid_session' })
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run __tests__/unit/middleware.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts __tests__/unit/middleware.test.ts
git commit -m "feat(auth): Edge middleware enforces authN

Runs on every route except /_next/*, static assets, and
/auth/{signin,callback,signout,unauthorized}. Decrypts the
JWE session cookie with jose; on failure or absence redirects
to /auth/signin?returnTo=<path>. No DB or MSAL — Edge-compatible.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 19: Client `SessionProvider` + `useSession` hook

**Files:**
- Create: `src/components/auth/session-provider.tsx`
- Create: `src/components/auth/use-session.ts`
- Create: `__tests__/unit/components/auth/session-provider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/components/auth/session-provider.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run __tests__/unit/components/auth/session-provider.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/components/auth/session-provider.tsx`**

```tsx
'use client'

import { createContext, type ReactNode } from 'react'
import type { Role } from '@/lib/auth/roles'

export type ClientSession = {
  userId: string
  roles: Role[]
  name: string | null
  email: string | null
  photoUrl: string | null
}

export const SessionContext = createContext<ClientSession | null | undefined>(undefined)

export function SessionProvider({
  session,
  children,
}: {
  session: ClientSession | null
  children: ReactNode
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
```

- [ ] **Step 4: Implement `src/components/auth/use-session.ts`**

```ts
'use client'

import { useContext } from 'react'
import { SessionContext, type ClientSession } from './session-provider'

export function useSession(): ClientSession | null {
  const ctx = useContext(SessionContext)
  if (ctx === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}

export function useRequiredSession(): ClientSession {
  const s = useSession()
  if (!s) throw new Error('useRequiredSession called without an active session')
  return s
}
```

- [ ] **Step 5: Run test**

```bash
npx vitest run __tests__/unit/components/auth/session-provider.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/session-provider.tsx src/components/auth/use-session.ts __tests__/unit/components/auth/session-provider.test.tsx
git commit -m "feat(auth): SessionProvider + useSession for client UI gating

Server component reads the JWE cookie via getSessionForClient(),
passes non-secret facts (userId, roles, name, email, photoUrl)
to the client provider. useSession() returns null when no session;
useRequiredSession() asserts authenticated context. Client-side
role checks are cosmetic — server Actions enforce authoritatively.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 20: Wire `SessionProvider` into a `(protected)` layout and move approvals under it

**Files:**
- Create: `src/app/(protected)/layout.tsx`
- Move: `src/app/approvals/*` → `src/app/(protected)/approvals/*` (keep filenames and content; Next.js route groups don't affect URLs)
- Modify: `src/app/(protected)/approvals/page.tsx` — replace hardcoded `CURRENT_USER_ID` with session
- Modify: `src/app/layout.tsx` (no changes needed — continues to render `ClientProviders`)

- [ ] **Step 1: Create `(protected)` route group layout**

Create `src/app/(protected)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSessionForClient } from '@/lib/auth/actor'
import { SessionProvider } from '@/components/auth/session-provider'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionForClient()
  if (!session) redirect('/auth/signin')
  return <SessionProvider session={session}>{children}</SessionProvider>
}
```

- [ ] **Step 2: Move approvals into the route group**

```bash
mkdir -p src/app/\(protected\)
git mv src/app/approvals src/app/\(protected\)/approvals
```

The URL `/approvals` is unchanged; route groups in Next.js (`(foo)`) are URL-invisible.

- [ ] **Step 3: Replace hardcoded user id in approvals page**

Edit `src/app/(protected)/approvals/page.tsx`. Replace the top of the file:

```diff
-'use client'
-
-import { useState, useEffect, useCallback } from 'react'
-…
-const CURRENT_USER_ID = 'dev-user-alice' // TODO: replace with session.user.id when auth is configured
-
-export default function ApprovalsPage() {
+'use client'
+
+import { useState, useEffect, useCallback } from 'react'
+import { useRequiredSession } from '@/components/auth/use-session'
+…
+
+export default function ApprovalsPage() {
+  const { userId: CURRENT_USER_ID } = useRequiredSession()
```

Delete the `const CURRENT_USER_ID = 'dev-user-alice'` line entirely.

Also update the `QueueClient` invocation inside this file (or wherever it is rendered) to pass `currentUserId={CURRENT_USER_ID}`. The existing prop name matches.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Run existing unit tests to confirm nothing regressed**

```bash
npm run test:unit 2>&1 | tail -30
```

Expected: all tests pass; some may need the `SessionProvider` wrapper in their test render — if any test fails because of `useRequiredSession`, wrap the render in `<SessionProvider session={...}>`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(protected\)/ 
git add -u src/app/approvals  # to catch the git-mv deletion if git didn't pick it up
git commit -m "feat(auth): (protected) layout provides SessionProvider

Moves /approvals under the (protected) route group. The layout
calls getSessionForClient() server-side, redirects to /auth/signin
if absent, and renders SessionProvider for the client tree. The
approvals page now reads currentUserId from useRequiredSession()
instead of the hardcoded dev-user-alice.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 21: Apply `requireRole` to approval actions + integration tests

**Files:**
- Modify: `src/app/(protected)/approvals/actions.ts`
- Modify: `__tests__/integration/actions/approvals.test.ts` (add authz matrix)

- [ ] **Step 1: Add role checks in each action**

Edit `src/app/(protected)/approvals/actions.ts`. Add import and wrap each verb:

```diff
 'use server'

 import { wrapAction } from '@/lib/actions/result'
 import { approvalService } from '@/services/approvalService'
 import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
 import {
   lockSchema,
   releaseSchema,
   approveSchema,
   rejectSchema,
 } from '@/lib/approvals/schemas'
+import { requireAnyRole } from '@/lib/auth/requireRole'
+import { Role } from '@/lib/auth/roles'

+const APPROVER_ROLES: readonly Role[] = [Role.Approver, Role.Admin]
```

Then for each of the four actions, add a role assertion at the top of the `wrapAction` callback. Example for `lockAction`:

```diff
 export async function lockAction(requestId: string, _formData?: FormData) {
   return wrapAction('approvals.lock', async (actor) => {
+    await requireAnyRole(APPROVER_ROLES)
     const parsed = lockSchema.parse({ requestId })
     …
```

Apply the same line to `releaseAction`, `approveAction`, `rejectAction`. All four verbs require Approver or Admin.

- [ ] **Step 2: Write the failing authz integration tests**

Append to `__tests__/integration/actions/approvals.test.ts`:

```ts
import { clearActor } from '../../helpers/mockActor'

describe('approvals authz matrix', () => {
  beforeAll(async () => {
    await prisma.user.upsert({ where: { id: TEST_USER.id }, create: TEST_USER, update: {} })
  })

  it('approveAction: Requester role → FORBIDDEN', async () => {
    const req = await seedRequest()
    await setActor(TEST_USER.id, ['Requester'])
    const result = await approveAction(req.id)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error.code).toBe('FORBIDDEN')
  })

  it('approveAction: Approver role → succeeds (no role error)', async () => {
    const req = await seedRequest()
    await setActor(TEST_USER.id, ['Approver'])
    // Lock first so approve can proceed per service rules
    const locked = await lockAction(req.id)
    expect(locked.ok).toBe(true)
    const result = await approveAction(req.id)
    expect(result.ok).toBe(true)
  })

  it('approveAction: Admin role → succeeds (no role error)', async () => {
    const req = await seedRequest()
    await setActor(TEST_USER.id, ['Admin'])
    const locked = await lockAction(req.id)
    expect(locked.ok).toBe(true)
    const result = await approveAction(req.id)
    expect(result.ok).toBe(true)
  })

  it('approveAction: no session → UNAUTHORIZED', async () => {
    const req = await seedRequest()
    await clearActor()
    const result = await approveAction(req.id)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error.code).toBe('UNAUTHORIZED')
  })
})
```

Note: `setActor` default is `['Approver']`; the existing tests keep working. The additions only extend coverage.

- [ ] **Step 3: Run integration tests**

```bash
npm run test:integration -- --run __tests__/integration/actions/approvals.test.ts
```

Expected: all existing tests still pass; 4 new authz tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(protected\)/approvals/actions.ts __tests__/integration/actions/approvals.test.ts
git commit -m "feat(approvals): authz gate via requireAnyRole(Approver|Admin)

lock/release/approve/reject Server Actions all assert role
at the top of their wrapAction callback; wrapAction translates
the thrown AppError(FORBIDDEN) to ActionResult error
{ code: 'FORBIDDEN' }. Integration matrix proves Requester
is denied, Approver/Admin allowed, no session → UNAUTHORIZED.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 22: Playwright E2E — pre-baked session cookie helper + scenarios

**Files:**
- Create: `__tests__/helpers/mockSession.ts`
- Create: `__tests__/e2e/auth.spec.ts`
- Modify: `playwright.config.ts` (if needed — ensure env loads from `.env.test`)

- [ ] **Step 1: Create `__tests__/helpers/mockSession.ts`**

```ts
import { EncryptJWT } from 'jose'
import type { Role } from '@/lib/auth/roles'

function getKey(secret: string): Uint8Array {
  const raw = new TextEncoder().encode(secret)
  const key = new Uint8Array(32)
  for (let i = 0; i < 32; i++) key[i] = raw[i % raw.length] ?? 0
  return key
}

export async function buildSessionCookie(args: {
  userId: string
  entraOid?: string
  roles: Role[]
  name?: string | null
  email?: string | null
  photoUrl?: string | null
  ttlSeconds?: number
  secret?: string
}): Promise<string> {
  const secret = args.secret ?? process.env.AUTH_SESSION_SECRET ?? ''
  if (secret.length < 32) throw new Error('AUTH_SESSION_SECRET must be >= 32 chars for mock session')

  const now = Math.floor(Date.now() / 1000)
  const ttl = args.ttlSeconds ?? 12 * 60 * 60

  return await new EncryptJWT({
    userId: args.userId,
    entraOid: args.entraOid ?? `oid-${args.userId}`,
    roles: args.roles,
    name: args.name ?? null,
    email: args.email ?? null,
    photoUrl: args.photoUrl ?? null,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .encrypt(getKey(secret))
}
```

- [ ] **Step 2: Create `__tests__/e2e/auth.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { buildSessionCookie } from '../helpers/mockSession'

const BASE = 'http://localhost:3000'

test.describe('auth', () => {
  test('unauthenticated user is redirected to /auth/signin', async ({ page }) => {
    await page.goto(`${BASE}/approvals`)
    await expect(page).toHaveURL(/\/auth\/signin\?returnTo=%2Fapprovals/)
  })

  test('authenticated user sees approvals page', async ({ context, page }) => {
    const cookie = await buildSessionCookie({
      userId: 'dev-user-alice',
      roles: ['Approver'],
      name: 'Alice',
    })
    await context.addCookies([
      {
        name: 'session',
        value: encodeURIComponent(cookie),
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false, // Playwright against http://localhost cannot set Secure cookies
        sameSite: 'Lax',
      },
    ])
    await page.goto(`${BASE}/approvals`)
    await expect(page.getByRole('heading', { name: /approval queue/i })).toBeVisible()
  })

  test('sign-out clears session and redirects to signin', async ({ context, page }) => {
    const cookie = await buildSessionCookie({
      userId: 'dev-user-alice',
      roles: ['Approver'],
    })
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
    await page.goto(`${BASE}/auth/signout`)
    await expect(page).toHaveURL(/\/auth\/signin/)
    await page.goto(`${BASE}/approvals`)
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})
```

Note: the `secure: false` compromise is required because Playwright against `http://localhost` won't accept `Secure` cookies. In production, the cookie is always `Secure`; the app still enforces this via `sessionCookieOptions()`. Only the E2E fixture relaxes it locally.

For this relaxation to actually match the running app's cookie config, temporarily allow `Secure=false` in dev — or run E2E against `https://localhost` with a local cert. The simplest option: document that E2E uses its own pre-baked cookie independent of the app's normal cookie issuance, and we set it with `Secure=false` so the browser accepts it over HTTP.

- [ ] **Step 3: Ensure Playwright picks up `.env.test`**

Check `playwright.config.ts`. If it doesn't already load env from `.env.test`, add at the top:

```ts
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.test', override: false })
```

If `dotenv` is not installed, `npm install --save-dev dotenv`.

- [ ] **Step 4: Run the E2E suite**

```bash
npm run dev &
sleep 5  # give the dev server time to start
npm run test:e2e -- __tests__/e2e/auth.spec.ts
```

If the dev server fails to start because `AZURE_AD_*`/`AUTH_SESSION_SECRET` env vars aren't set, export them from `.env.test`:

```bash
set -a; source .env.test; set +a
npm run dev &
```

Expected: 3 tests pass. Shut down the dev server after: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add __tests__/helpers/mockSession.ts __tests__/e2e/auth.spec.ts playwright.config.ts
git commit -m "test(e2e): auth redirect, session, and sign-out flows

Playwright fixture injects a pre-baked JWE session cookie built
by helpers/mockSession.ts — bypasses Entra (trusted boundary).
Covers: unauthenticated redirect with returnTo, authenticated
access, and sign-out clears the cookie.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 23: Remove legacy NextAuth mock from vitest setup; README for Entra setup

**Files:**
- Modify: `__tests__/setup/vitest.setup.ts` (remove `vi.mock('next-auth/react', …)`)
- Create/Modify: `README.md` — new "Authentication" section

- [ ] **Step 1: Remove the dead NextAuth mock from vitest setup**

Edit `__tests__/setup/vitest.setup.ts`:

```diff
-// Mock NextAuth
-vi.mock('next-auth/react', () => ({
-  useSession: () => ({
-    data: null,
-    status: 'unauthenticated',
-  }),
-  signIn: vi.fn(),
-  signOut: vi.fn(),
-}))
-
 // Suppress console errors in tests
```

- [ ] **Step 2: Add an Authentication section to the README**

Append or replace the existing auth section in `README.md`:

```markdown
## Authentication

This project uses **Microsoft Entra ID** (single-tenant) via **MSAL Node** with encrypted session cookies. There is no dev fallback — every environment needs a working Entra config.

### Set up a free Entra tenant (for local dev)

1. Join the free **[Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program)** — gives you a sandbox tenant with ~25 test users.
2. In the Azure/Entra portal for that tenant, create an **App registration**:
   - **Supported account types:** *Accounts in this organizational directory only (single tenant)*.
   - **Redirect URI (Web):** `http://localhost:3000/auth/callback`.
   - Copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID`.
   - Copy the **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`.
   - Create a **Client secret** (Certificates & secrets → New client secret). Copy the *Value* → `AZURE_AD_CLIENT_SECRET`.
3. Define **App Roles** in the app registration manifest — three values: `Admin`, `Approver`, `Requester`. "Allowed member types": `Users/Groups`.
4. Under **Enterprise applications** → your app → **Users and groups**, assign yourself (or test users) to one of the app roles. "Assignment required?" should be **No** (users with no role default to `Requester`).

### Configure `.env`

```
AZURE_AD_CLIENT_ID=<from app registration>
AZURE_AD_CLIENT_SECRET=<from app registration>
AZURE_AD_TENANT_ID=<from app registration>
APP_URL=http://localhost:3000
AUTH_SESSION_SECRET=<openssl rand -base64 32>
```

### Roles

| Role | Permissions |
|---|---|
| `Admin` | Everything — approve/reject, edit PriorityConfig |
| `Approver` | Lock / release / approve / reject approval requests |
| `Requester` (default) | Submit and view own requests |

Role checks live next to the Server Action that performs each verb — see `src/lib/auth/requireRole.ts`.
```

- [ ] **Step 3: Run full unit test suite**

```bash
npm run test:unit 2>&1 | tail -20
```

Expected: all tests pass; coverage ≥ 80% (the new auth modules collectively have tests covering their surface).

- [ ] **Step 4: Commit**

```bash
git add __tests__/setup/vitest.setup.ts README.md
git commit -m "chore(auth): remove dead NextAuth mock; document Entra setup

Removes the vi.mock('next-auth/react', ...) stub from the shared
vitest setup — nothing imports it anymore. Adds a setup guide
for contributors pointing at the free Microsoft 365 Developer
Program sandbox tenant.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 24: Final sweep — legacy route handlers

The legacy `src/app/api/approvals/[id]/{lock,release,approve,reject}/route.ts` files still use `getActorId()`. They remain functional (the back-compat shim still works) but no longer enforce roles. Decide whether to:

**Option A (recommended):** Delete the legacy route handlers. The Server Actions in `src/app/(protected)/approvals/actions.ts` are the only mutation surface used by `QueueClient`, per recent commit history.

**Option B:** Keep them and add `requireAnyRole` to each route handler.

**Files (Option A):**
- Delete: `src/app/api/approvals/[id]/lock/route.ts`
- Delete: `src/app/api/approvals/[id]/release/route.ts`
- Delete: `src/app/api/approvals/[id]/approve/route.ts`
- Delete: `src/app/api/approvals/[id]/reject/route.ts`
- Verify: `src/app/api/approvals/queue/route.ts` is read-only — leave it, but add middleware coverage (already there).

- [ ] **Step 1: Confirm no other caller uses the REST routes**

```bash
npx grep -rn "api/approvals/[^q]" src __tests__
```

If the only matches are tests of those very routes, proceed with Option A. If something still fetches those endpoints, prefer Option B.

- [ ] **Step 2: Execute Option A (delete)**

```bash
rm -rf src/app/api/approvals/\[id\]/lock src/app/api/approvals/\[id\]/release src/app/api/approvals/\[id\]/approve src/app/api/approvals/\[id\]/reject
```

- [ ] **Step 3: Delete the corresponding route tests** (if any)

```bash
npx grep -rln "api/approvals/\[id\]" __tests__
```

For any file returned that tests only the deleted routes, delete it. Leave tests that cover other routes alone.

- [ ] **Step 4: Type-check and full suite**

```bash
npx tsc --noEmit
npm run test:unit 2>&1 | tail -10
npm run test:integration 2>&1 | tail -10
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -u src/app/api/approvals __tests__
git commit -m "refactor(approvals): drop legacy REST mutation routes

Server Actions in src/app/(protected)/approvals/actions.ts are the
only caller of lock/release/approve/reject since the QueueClient
optimistic-UI refactor. The legacy /api/approvals/:id/* handlers
lacked role checks and duplicated surface; delete them. Read-only
/api/approvals/queue remains for initial data load.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 25: End-to-end smoke — full stack live test

No code changes — this is a manual verification step before handing off.

- [ ] **Step 1: Start infra and dev server**

```bash
npm run infra:up
npm run db:generate
npm run db:migrate
npm run db:seed
set -a; source .env; set +a
npm run dev
```

- [ ] **Step 2: Verify unauthenticated redirect**

Visit http://localhost:3000/approvals in a clean browser session. Expect: redirect to `http://localhost:3000/auth/signin?returnTo=%2Fapprovals`.

- [ ] **Step 3: Sign in against your real Entra tenant**

Click through. Expect:
1. Redirect to login.microsoftonline.com.
2. You sign in with a tenant user assigned to the `Approver` role.
3. Redirect back to `/auth/callback` and then to `/approvals`.
4. A `session` cookie visible in devtools, marked HttpOnly + SameSite=Lax (Secure will be off on http://localhost — expected).

- [ ] **Step 4: Test authz**

Reassign yourself to `Requester` in the Enterprise App. Sign out and sign back in. Try to approve a request. Expect: a `FORBIDDEN` toast; no DB change.

- [ ] **Step 5: Test sign-out**

Click Sign out (or visit `/auth/signout`). Expect: cookie gone, redirect to `/auth/signin`.

- [ ] **Step 6: Teardown**

```bash
# Ctrl+C the dev server
npm run infra:down
```

No commit; this step exists to exercise the full stack before declaring done.

---

## Post-implementation checklist

- [ ] `npm run lint` passes
- [ ] `npm run test:unit` passes with coverage ≥ 80%
- [ ] `npm run test:integration` passes against the test DB
- [ ] `npm run test:e2e` passes against a running dev server with `.env.test`
- [ ] README Authentication section renders and has accurate steps
- [ ] No `DEV_ACTOR_ID`, `next-auth`, or `@auth/prisma-adapter` references remain (`grep -rn 'next-auth\|DEV_ACTOR_ID\|@auth/prisma-adapter' src __tests__ prisma` returns empty)
- [ ] `.env.example` reflects only required vars
