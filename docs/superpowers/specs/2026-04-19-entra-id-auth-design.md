# Production-Grade Microsoft Entra ID Authentication & Authorization

**Date:** 2026-04-19
**Branch:** `auth`
**Status:** Design — awaiting implementation plan

## Summary

Replace the current stubbed `next-auth` + dev-fallback wiring with a production-grade, Microsoft-native auth stack:

- **MSAL Node** (`@azure/msal-node`) as the confidential OAuth 2.0 / OIDC client.
- **Authorization Code + PKCE** flow against a **single Entra tenant**.
- **Encrypted-cookie sessions** (JWE via `jose`) — stateless, Edge-compatible, 12h sliding.
- **App Roles in token** → three roles: `Admin`, `Approver`, `Requester` (default).
- **Authentication** enforced in middleware; **authorization** enforced next to each verb via a typed `requireRole()` helper thrown as `AppError(FORBIDDEN)`.

This replaces NextAuth v5 entirely. The codebase gains ~300-500 lines of auth plumbing in exchange for full ownership of the auth path and first-class Entra feature support (PKCE, Conditional Access, Continuous Access Evaluation when needed later).

## Goals

- Single-tenant Entra ID sign-in for the organization's employees.
- Role-based authorization for approvals verbs (lock/release/approve/reject) and admin configuration (PriorityConfig).
- Production-grade defaults: encrypted session cookies, PKCE, CSRF state, HttpOnly/Secure/SameSite cookies, no dev fallbacks.
- Testable in isolation — unit tests without hitting Entra, integration tests with mocked Entra (MSW), Playwright E2E with pre-baked session cookies.
- Zero client-side MSAL: browser never holds tokens. All token handling is server-side.

## Non-Goals

- Multi-tenant support.
- Entra External ID / B2C flows.
- Client-side Graph calls (only server-side photo fetch at sign-in).
- Federated sign-out (local sign-out only; Entra SSO session persists).
- Certificate-based client auth (client secret is sufficient for initial build; cert is a later upgrade).
- Group-based role assignment (requires Entra ID P1; we assign individual users manually in the free tier).
- Instant role revocation inside an active session (JWT-style session accepts up to 12h propagation delay).

## Context

Existing state on branch `auth` at time of this spec:

- `next-auth@5.0.0-beta.18` and `@auth/prisma-adapter` are listed in `package.json` but never wired.
- Prisma schema has NextAuth-shaped `Account`, `Session`, `VerificationToken`, `User` tables.
- `.env.example` lists `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID` placeholders.
- `src/lib/auth/actor.ts` calls v4's `getServerSession()` and falls back to `DEV_ACTOR_ID` outside production.
- No `middleware.ts`, no `auth.ts` config, no route handlers under `/auth/*`.

The approvals feature already follows a layered repository → service → route pattern with typed `AppError`s translated by `handleApiError` (route handlers) and `wrapAction` (Server Actions). This design extends that pattern to auth/authz.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Single tenant (one Entra directory) | Internal tool for one org. |
| 2 | App Roles in token (not groups, not DB roles) | Free tier supports individual user assignment to app roles; claim arrives on the ID token. |
| 3 | Three roles: `Admin`, `Approver`, `Requester`; default `Requester` when no claim | Minimum viable taxonomy for approvals domain. |
| 4 | JWT-style stateless session (encrypted cookie, JWE) | Edge-compatible middleware; no DB hit per request; accepted tradeoff: up to 12h revocation delay. |
| 5 | Fully gated — everything requires sign-in except `/auth/*` and static assets | Internal tool; no anonymous surface. |
| 6 | Basic Graph scope (`User.Read`) for profile photo at sign-in | Fetch once, cache on `User.image`; no ongoing Graph traffic. |
| 7 | No dev fallback — Entra required in every environment | Consistency between dev, CI, staging, prod. Contributors use a free M365 Dev Program tenant. |
| 8 | Local sign-out only | Friendlier on shared or personal devices; Entra SSO session persists. |
| 9 | Enterprise App "Assignment required" = **No**; unassigned users default to `Requester` | Frictionless onboarding for anyone in the tenant. |
| 10 | MSAL Node (not NextAuth) | Microsoft-native, future-proof for Conditional Access / CAE; explicit rather than abstracted. |
| 11 | Authz approach **B**: middleware = authN only; Server Actions/services call `requireRole()` | Matches existing service-layer pattern where `AppError`s are thrown next to the verb they guard. |

## Architecture

### Flow

```
Browser ──► GET /auth/signin
             │  MSAL builds auth URL; PKCE verifier + state stored in short-lived cookie
             ▼
         Entra ID sign-in page
             │  user authenticates
             ▼
Browser ──► GET /auth/callback?code=…&state=…
             │  validate state → MSAL acquireTokenByCode → upsert User by entraOid
             │  fetch photo via Graph (one-shot) → set encrypted session cookie (JWE)
             ▼
         302 → returnTo or /
             │
Browser ──► any protected route
             │  middleware.ts (Edge): decrypt session cookie → allow or 302 /auth/signin
             │
Server Action ──► getActor() reads session
                  requireRole('Approver') → AppError(FORBIDDEN) or proceed
```

### Runtime split

- **Edge runtime:** `middleware.ts` only. Uses `jose` to decrypt the session cookie. No Prisma, no MSAL.
- **Node runtime:** `/auth/callback`, `/auth/signin`, `/auth/signout` route handlers and all Server Actions. MSAL Node, Prisma, Graph fetch all happen here.

### Layered responsibilities

- `src/lib/auth/config.ts` — validates env vars at module load; exits if misconfigured in production.
- `src/lib/auth/msal.ts` — singleton `ConfidentialClientApplication` using MSAL's default in-memory cache (sufficient for one-shot photo fetch at sign-in; no refresh-token persistence needed in this build).
- `src/lib/auth/session.ts` — JWE encode/decode; pure functions, no I/O.
- `src/lib/auth/cookies.ts` — cookie helpers (session, oauth_state, pkce_verifier).
- `src/lib/auth/actor.ts` — `getActor()` reads session → `{ id, roles }`; throws `UNAUTHORIZED`.
- `src/lib/auth/requireRole.ts` — `requireRole(role)`, `requireAnyRole(roles[])`; throws `FORBIDDEN`.
- `src/lib/auth/roles.ts` — `Role` const + type, `parseRolesClaim()`.
- `src/lib/auth/graph.ts` — `fetchUserPhoto(accessToken)`; returns data URI or null.

## Components

### New files

```
src/lib/auth/
├── config.ts
├── msal.ts
├── session.ts
├── cookies.ts
├── actor.ts                (rewritten; replaces existing stub)
├── requireRole.ts
├── roles.ts
└── graph.ts

src/app/auth/
├── signin/route.ts
├── callback/route.ts
├── signout/route.ts
└── unauthorized/page.tsx

src/middleware.ts           (new; runs on Edge)

__tests__/helpers/
├── mockActor.ts             (extend: accept roles)
└── mockSession.ts           (new; builds JWE cookie for Playwright)

__tests__/mocks/
└── entra.ts                 (new; MSW handlers for token endpoint + Graph photo)
```

### Prisma schema changes

**Remove:**
- `Account`
- `Session`
- `VerificationToken`

**Modify `User`:**
- Add `entraOid String @unique` — stable Entra object ID.
- Keep `id` as cuid so existing `ApprovalRequest.requesterId`/`assigneeId`/`approvedById` foreign keys are untouched.
- Keep `name`, `email`, `image`.

**No new tables added.** The original draft included a `MsalTokenCache` table to persist MSAL's refresh-token cache. Since we only need Graph for a *one-shot* photo fetch at sign-in (while we still hold the fresh access token), the refresh token is never used after that single call. MSAL's default in-memory cache is sufficient for the single request lifecycle of `/auth/callback`.

If/when we add live photo refresh or additional Graph scopes, we introduce `MsalTokenCache` at that point — not speculatively now.

### Error additions — `src/lib/errors/AppError.ts`

```ts
ErrorCode.FORBIDDEN = 'FORBIDDEN'

AppError.forbidden(requiredRoles: Role[]) => AppError {
  statusCode: 403,
  code: FORBIDDEN,
  message: `Requires role: ${requiredRoles.join(' or ')}`,
}
```

`UNAUTHORIZED` already exists and is reused.

### Environment variables

**Add:**
- `AUTH_SESSION_SECRET` — 32+ random bytes (base64); used to derive JWE encryption key via HKDF. Generate with `openssl rand -base64 32`.
- `APP_URL` — absolute URL of the app (e.g., `http://localhost:3000`); used to build the `redirect_uri` and validate `returnTo`.

**Keep (already in `.env.example`):**
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`

**Remove:**
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (superseded by `APP_URL`)

### Dependencies

**Remove:** `next-auth`, `@auth/prisma-adapter`
**Add:** `@azure/msal-node`, `jose`

### Session payload shape

```ts
type SessionPayload = {
  userId: string            // internal cuid
  entraOid: string          // Entra object ID
  roles: Role[]             // ['Admin'] | ['Approver'] | ['Requester'] | combinations
  name: string | null
  email: string | null
  photoUrl: string | null   // data URI, small; or absolute URL if we later upload to storage
  iat: number               // seconds since epoch
  exp: number               // iat + 12h
}
```

## Data Flow

### Sign-in initiation — `GET /auth/signin`

1. Generate PKCE verifier + SHA-256 challenge.
2. Generate `state` nonce; validate `returnTo` query param (must start with `/`, reject absolute URLs, reject `//…`).
3. Set short-lived (10 min) `oauth_pending` cookie with `{ state, codeVerifier, returnTo }` (HttpOnly, Secure, SameSite=Lax, Path=/auth/callback).
4. MSAL `getAuthCodeUrl({ scopes: ['openid','profile','email','offline_access','User.Read'], redirectUri, codeChallenge, codeChallengeMethod: 'S256', state })`.
5. `302 Location: <auth-code-url>`.

### Callback — `GET /auth/callback?code=…&state=…`

1. Read `oauth_pending`. If missing or `state` mismatch → clear cookie, redirect to `/auth/signin?error=state_mismatch`.
2. `acquireTokenByCode({ code, codeVerifier, redirectUri, scopes })`.
3. Extract from `idTokenClaims`: `oid`, `name`, `preferred_username` (email), `roles?`.
4. `parseRolesClaim(claims.roles)` — defaults to `['Requester']` if missing, empty, or contains only unknown values; unknown values filtered with a warn log.
5. `prisma.user.upsert({ where: { entraOid }, create: { entraOid, name, email, image: null }, update: { name, email } })`.
6. If `User.image` is null, call `graph.fetchUserPhoto(accessToken)`; on success persist data URI to `User.image` (tolerate failure — log + continue with null).
7. Build session payload with `exp = now + 12h`; encode as JWE.
8. Clear `oauth_pending`; set `session` cookie (HttpOnly, Secure, SameSite=Lax, Path=/, maxAge=43200).
9. `302 Location: <returnTo ?? '/'>`.

### Protected request

1. `middleware.ts` (Edge): read `session` cookie; `jose.jwtDecrypt` with `AUTH_SESSION_SECRET`.
   - Valid and not expired → forward (stateless; no header injection).
   - Missing / tampered / expired → `302 /auth/signin?returnTo=<original-path>`.
2. Route handler or Server Action calls `await getActor()` → `{ id, roles }`. Throws `UNAUTHORIZED` if cookie absent (defense in depth; middleware should have caught it).
3. For gated verbs, `await requireRole('Approver')` or `requireAnyRole(['Approver','Admin'])`. Throws `AppError.forbidden(requiredRoles)`; `handleApiError` / `wrapAction` translate to 403.

### Sliding expiration

On every Server Action / authenticated route handler, `getActor()` inspects `now - iat`. If it exceeds 6h (halfway through the 12h life), `getActor()` re-encodes the payload with a fresh 12h `exp` and calls `cookies().set('session', …)` directly — supported in Server Actions and Route Handlers in Next.js App Router. Middleware does not refresh (Edge runtime + stateless). Idle users time out at 12h; active users stay in indefinitely (up to revocation constraints).

### Sign-out — `POST /auth/signout`

1. Clear `session` cookie (Max-Age=0).
2. `302 Location: /auth/signin`.
3. No federated logout — Entra SSO session persists.

(There is no server-side token cache to clear in this build — MSAL uses in-memory cache scoped to the callback request.)

### Known limitation (accepted)

Roles changed in Entra during an active session propagate only when the session expires (≤12h) or the user signs out/in. This is intrinsic to the JWT-style session choice. If instant revocation becomes needed later, the mitigation is either (a) shorten session lifetime, or (b) migrate to DB-backed sessions — both are isolated changes.

## Error Handling

| Failure | Where | User sees | Server does |
|---|---|---|---|
| No session cookie on protected route | middleware | `302 /auth/signin?returnTo=…` | silent |
| Session cookie tampered / bad signature | middleware | `302 /auth/signin?error=invalid_session` | clear cookie, log warn |
| Session expired | middleware | `302 /auth/signin?returnTo=…` | clear cookie |
| `state` mismatch at callback | `/auth/callback` | `302 /auth/signin?error=state_mismatch` | clear `oauth_pending`, log warn |
| MSAL `acquireTokenByCode` fails | `/auth/callback` | `302 /auth/unauthorized?reason=token_exchange` | log error with MSAL error code |
| Entra returns `AADSTS*` error in callback query | `/auth/callback` | `302 /auth/unauthorized?reason=entra&code=<aadsts>` | log |
| Graph photo fetch fails | `/auth/callback` | user proceeds without avatar | log warn, continue |
| User upsert fails | `/auth/callback` | `302 /auth/unauthorized?reason=provisioning` | log error |
| `getActor()` called with no session (Server Action) | service / route | `AppError(401 UNAUTHORIZED)` | `wrapAction` / `handleApiError` format |
| `requireRole()` fails | service / route | `AppError(403 FORBIDDEN)` | `wrapAction` / `handleApiError` format |

### Unauthorized page — `/auth/unauthorized`

Server component reading `?reason=…`. Renders a non-technical explanation and a "sign in again" link. Reasons: `token_exchange`, `entra`, `provisioning`, `forbidden`. No stack traces, no raw MSAL codes in the UI — those go to server logs.

### Telemetry

All auth events wrapped in `createSpan('auth.<event>', …)` — e.g., `auth.signin`, `auth.callback`, `auth.token_exchange_failed`, `auth.forbidden`. Span attributes: `entraOid` when known, `error.code`, `error.reason`. Never log: tokens, secrets, full claim payloads.

### Security rules (explicit)

- `state` and `codeVerifier` are single-use — cleared on both success and failure.
- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. (Lax allows the top-level redirect from Entra to land with the cookie sendable to `/auth/callback`; Strict would break the flow.)
- `returnTo` validated as a same-origin relative path (must start with `/`, must not start with `//`). Prevents open-redirect.
- Session cookie re-issued on sliding refresh — never extended in place.
- `AUTH_SESSION_SECRET` rotation: future-proofed as a comma-separated list; decode tries each in order, encode uses the first. (Implementation may defer the list form to a follow-up; initial build can hard-wire one secret.)

## Testing

### Unit (jsdom/node, 80% coverage gate)

| Module | Tests |
|---|---|
| `session.ts` | encode→decode roundtrip preserves fields; expired payload rejected; tampered ciphertext rejected; wrong key rejected; `iat`/`exp` arithmetic. |
| `roles.ts` | `parseRolesClaim`: valid known roles, missing → `['Requester']`, unknown filtered, empty → `['Requester']`, string (not array) → `['Requester']` + warn. |
| `requireRole.ts` | Admin passes for `requireRole('Admin')`; missing role throws `FORBIDDEN`; `requireAnyRole(['Approver','Admin'])` matrix. |
| `cookies.ts` | Cookie options correct; `returnTo` validation rejects `//evil`, `http://evil`, `javascript:`; accepts `/approvals/123`. |
| `actor.ts` | Returns `{ id, roles }` for valid session; throws `UNAUTHORIZED` when cookie absent or invalid. |
| `graph.ts` | Fetches `/me/photo/$value`; 200 → data URI; 404 → null; 401/5xx → null + log. MSW-based. |

### Integration (`__tests__/integration/`, real test DB on port 5433)

| Flow | Tests |
|---|---|
| Callback happy path | MSW-mocked Entra returning tokens + claims; assert User upserted, session cookie set. |
| Callback state mismatch | Mismatched state; assert redirect with error, no User, no cookie. |
| Callback with `roles: ['Approver']` claim | Session contains `['Approver']`. |
| Callback with no `roles` claim | Session contains `['Requester']`. |
| Repeat sign-in | Same `entraOid` → User updated, not duplicated. |
| Server Action authZ matrix | `approveApproval`: Requester → FORBIDDEN, Approver → success, Admin → success, no session → UNAUTHORIZED. |

### E2E (Playwright)

| Scenario | Test |
|---|---|
| Unauthenticated redirect | Visit `/approvals`; assert redirect to `/auth/signin?returnTo=%2Fapprovals`. |
| Sign-in → approval action | Fixture sets pre-baked session cookie (bypasses Entra — trusted boundary); full approve flow. |
| Sign-out clears session | Click sign-out; cookie cleared; next nav redirects to signin. |
| Forbidden role boundary | Cookie with `roles: ['Requester']`; attempt approve; expect 403 toast, no DB change. |

### Test infrastructure additions

- **`__tests__/helpers/mockActor.ts`** — extend to accept `roles: Role[]`.
- **`__tests__/helpers/mockSession.ts`** — build a JWE session cookie using test `AUTH_SESSION_SECRET`.
- **`__tests__/mocks/entra.ts`** — MSW handlers for `login.microsoftonline.com/{tenant}/oauth2/v2.0/token` and `graph.microsoft.com/v1.0/me/photo/$value`.
- **`.env.test`** — distinct `AUTH_SESSION_SECRET`, fake `AZURE_AD_*`.

### Not tested (explicit scope)

- Microsoft's side of the OAuth dance (trust boundary).
- Token cache cross-instance consistency (single-instance for this iteration).
- Certificate-based client auth (later upgrade).

## Migration & Rollout

This feature ships on the `auth` branch. Since the app has no production users yet, the migration is straightforward:

1. Drop `Account`, `Session`, `VerificationToken` tables via a new Prisma migration.
2. Add `User.entraOid` column + unique index; backfill is not required (dev/seed users will be recreated via Entra sign-in, or seeded with synthetic oids).
3. Update `prisma/seed.js` to either (a) skip user seeding and rely on Entra sign-in, or (b) seed users with synthetic `entraOid` values for tests only.
4. Remove `DEV_ACTOR_ID` and the dev-fallback branch from `actor.ts`.

## Open Questions (none)

All decisions resolved during brainstorming. Implementation plan can proceed.

## References

- [MSAL Node docs](https://learn.microsoft.com/entra/msal/node/)
- [Microsoft Entra ID authentication flows](https://learn.microsoft.com/entra/identity-platform/authentication-flows-app-scenarios)
- [App Roles in Entra ID](https://learn.microsoft.com/entra/identity-platform/howto-add-app-roles-in-apps)
- [`jose` library for JWE](https://github.com/panva/jose)
- [Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program) — free tenant for learning/testing
