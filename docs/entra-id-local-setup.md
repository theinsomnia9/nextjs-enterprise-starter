# Local Entra ID (Single-Tenant) Setup for Development

This app uses **Microsoft Entra ID** (formerly Azure AD) as its single identity provider via MSAL Node with Authorization Code + PKCE. There is **no dev fallback** — every environment (local, CI, staging, prod) requires a real Entra tenant. This guide walks a new contributor from zero to a working local sign-in.

Estimated time: 20–30 minutes the first time, ~5 minutes for subsequent tenants.

## Prerequisites

- A Microsoft account. If you don't have one, [create one free](https://account.microsoft.com/account).
- Admin access to an Entra tenant. If you don't have one, use the free **Microsoft 365 Developer Program** tenant (Step 1).
- Local app dependencies installed (`npm install`) and Docker running (`npm run infra:up`).

## Step 1 — Get a single-tenant Entra directory

Pick one:

### Option A: Microsoft 365 Developer Program (recommended for contributors)

1. Go to <https://developer.microsoft.com/microsoft-365/dev-program> and click **Join now**.
2. Sign in with any Microsoft account and complete the short questionnaire.
3. When prompted, choose **Instant sandbox** → **Set up E5 subscription**. You'll:
   - Pick a tenant domain prefix (e.g., `mikeboiler`) — your tenant becomes `mikeboiler.onmicrosoft.com`.
   - Create an **admin** account (e.g., `admin@mikeboiler.onmicrosoft.com`) with its own password.
4. Wait ~2 minutes for provisioning. You'll land in the M365 admin portal.

The sandbox is free, renews every 90 days while active, and comes pre-seeded with 25 test users.

### Option B: Your company's Entra tenant

Only viable if your IT admin is willing to register a dev app and assign you. Most orgs won't. Prefer Option A for individual dev loops.

### Option C: Pay-as-you-go Azure tenant

If you already have an Azure subscription, it has a default Entra directory. Use it. No cost for Entra ID Free tier (sufficient for this app).

## Step 2 — Register the app in Entra

1. Open the [Azure Portal](https://portal.azure.com) and sign in with the tenant's **admin** account.
2. Top-bar search → **Microsoft Entra ID** → open it.
3. Left sidebar → **App registrations** → **+ New registration**.
4. Fill in:
   - **Name**: `nextjs-boilerplate-local` (or your preference).
   - **Supported account types**: **Accounts in this organizational directory only (Single tenant)**.
   - **Redirect URI**: select **Web** and enter `http://localhost:3000/auth/callback`.
5. Click **Register**.

On the app's **Overview** page, copy these three values — they become env vars:

| Portal label | Env var |
|---|---|
| **Application (client) ID** | `AZURE_AD_CLIENT_ID` |
| **Directory (tenant) ID** | `AZURE_AD_TENANT_ID` |
| *(generated next step)* | `AZURE_AD_CLIENT_SECRET` |

## Step 3 — Create a client secret

1. In the same app registration → **Certificates & secrets** → **+ New client secret**.
2. Description: `local-dev`. Expires: **180 days** (or shorter for safety).
3. Click **Add**. Immediately copy the **Value** column (not the Secret ID) — it's only visible once.
4. Save as `AZURE_AD_CLIENT_SECRET`.

## Step 4 — Configure the redirect URI & token settings

1. Left sidebar → **Authentication**.
2. Confirm `http://localhost:3000/auth/callback` is listed under **Web** → **Redirect URIs**. Add more if you run on a non-default port (e.g., `http://localhost:4000/auth/callback`).
3. Under **Implicit grant and hybrid flows**: leave **both boxes unchecked** (we use PKCE, not implicit flow).
4. Under **Advanced settings** → **Allow public client flows**: **No**.
5. Click **Save**.

## Step 5 — Grant API permissions

The app calls Microsoft Graph once, server-side, to fetch the user's profile photo on first sign-in.

1. Left sidebar → **API permissions**.
2. The default **Microsoft Graph → User.Read (Delegated)** permission is already present. Leave it.
3. Click **Grant admin consent for <your tenant>** → **Yes**. Status should turn green with a checkmark.

No other permissions are required for this app.

## Step 6 — Define app roles

This app authorizes actions by role claim on the ID token. Create three:

1. Left sidebar → **App roles** → **+ Create app role**.
2. Create each of the following (the **Value** field must match exactly — the code looks these up literally):

| Display name | Allowed member types | Value | Description |
|---|---|---|---|
| Admin | Users/Groups | `Admin` | Full admin access; can edit PriorityConfig. |
| Approver | Users/Groups | `Approver` | Can lock, approve, and reject approval requests. |
| Requester | Users/Groups | `Requester` | Can submit approval requests (default). |

3. Check **Do you want to enable this app role?** on each → **Apply**.

> **Why these exact values?** `src/lib/auth/roles.ts` defines the canonical set. Any other string is filtered out at sign-in with a warn log and the user defaults to `Requester`.

## Step 7 — Assign users to roles (optional but recommended)

Unassigned users will sign in successfully but land with the default `Requester` role. To test Approver/Admin paths, you must assign yourself.

1. Top-bar search → **Enterprise applications** → find `nextjs-boilerplate-local`.
2. Left sidebar → **Properties** → set **Assignment required?** to **No** (frictionless onboarding during dev) → **Save**.
3. Left sidebar → **Users and groups** → **+ Add user/group**.
4. Pick a user (yourself, or one of the seeded dev-program users) → pick a role (**Approver** or **Admin**) → **Assign**.
5. Repeat for additional test identities. Each user can only hold one role assignment here; for multiple roles, assign the same user multiple times.

## Step 8 — Wire env vars into the app

In the project root:

```bash
cp .env.example .env
```

Open `.env` and fill in:

```bash
# From Azure Portal → App registration → Overview
AZURE_AD_CLIENT_ID="<Application (client) ID>"
AZURE_AD_TENANT_ID="<Directory (tenant) ID>"
# From Step 3
AZURE_AD_CLIENT_SECRET="<client secret Value>"

# Must match what you registered in Step 2 (no trailing slash)
APP_URL="http://localhost:3000"

# Generate fresh — do NOT reuse across environments
AUTH_SESSION_SECRET="$(openssl rand -base64 32)"
```

Run the `openssl` command in your shell and paste the result into the file (or use your editor to shell out).

> `AUTH_SESSION_SECRET` must be ≥32 characters. Shorter values throw at module load — `src/lib/auth/config.ts:21`.

## Step 9 — Database migration & seed

The `User` table stores `entraOid` (Entra Object ID) as the stable user identifier. Run pending migrations:

```bash
npm run infra:up     # start Postgres if not already running
npm run db:migrate   # apply Prisma migrations
npm run db:seed      # seed PriorityConfig rows (safe to re-run)
```

The seed does **not** create users — they are provisioned automatically on first Entra sign-in via `prisma.user.upsert({ where: { entraOid } })` in `src/app/auth/callback/route.ts`.

## Step 10 — First sign-in

```bash
npm run dev
```

1. Open <http://localhost:3000>. Middleware (`src/middleware.ts`) redirects you to `/auth/signin`.
2. `/auth/signin` builds the MSAL auth URL (PKCE + state) and 302s you to `login.microsoftonline.com`.
3. Sign in with an account from your tenant (e.g., `admin@<prefix>.onmicrosoft.com` or a seeded test user).
4. Consent to **Sign you in and read your profile** on first use.
5. You land back on `/auth/callback` which exchanges the code, upserts the user, fetches your profile photo, sets an encrypted session cookie, and redirects to `/`.

Verify the session:

- DevTools → Application → Cookies → `session` cookie is present, `HttpOnly`, `Secure=false` (localhost), `SameSite=Lax`.
- `User` row exists in the DB (`npm run db:studio` → User table → row with your `entraOid`).
- Your assigned role appears in UI elements gated by `useSession()`. Requester-only users won't see Approve/Reject buttons; Approvers will.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `AADSTS50011: redirect_uri mismatch` | Redirect URI in Azure ≠ `${APP_URL}/auth/callback` | Step 4; watch for trailing slashes and port mismatches. |
| `AADSTS700016: Application not found in tenant` | `AZURE_AD_TENANT_ID` points to the wrong tenant, or you're signing in with a personal Microsoft account against a single-tenant app | Use an account inside the tenant; double-check the tenant ID on the app's Overview page. |
| `AADSTS7000215: Invalid client secret` | Secret expired, was regenerated, or copied from the Secret ID field instead of Value | Step 3; create a new secret and update `.env`. |
| `[auth/config] Missing required env var: …` on `npm run dev` | `.env` not loaded or key missing | Confirm filename is `.env`, not `.env.local`; restart dev server after edits. |
| `[auth/config] AUTH_SESSION_SECRET must be at least 32 characters` | Secret too short | Regenerate with `openssl rand -base64 32`. |
| Signed in but stuck with `Requester` when expecting Approver/Admin | No role assignment, or role `Value` typo | Step 7 — confirm the **Value** column matches `Admin`/`Approver`/`Requester` exactly (case-sensitive). |
| `302 /auth/signin?error=state_mismatch` in a loop | Browser blocking cookies, or `APP_URL` scheme/host doesn't match the browser URL | Confirm you visit the same host/port as `APP_URL`; third-party cookies must be allowed for localhost. |
| Sign-in works but `/auth/callback` returns `?reason=provisioning` | Database unreachable, or migration not run | `npm run infra:up` and `npm run db:migrate`. |
| `AADSTS65001: user has not consented` | Admin consent was not granted for `User.Read` | Step 5 — re-click **Grant admin consent**. |

## Adding more contributors

Each contributor needs **either** their own tenant (recommended — M365 Dev Program is free and takes 10 minutes) or a user account in yours. Sharing tenants is convenient but couples your roles/test data. A shared client secret in `.env` should never be committed — everyone creates their own app registration.

## Rotating the client secret

Client secrets in this setup expire per Step 3. When the old secret still works but is close to expiry:

1. Azure Portal → app registration → **Certificates & secrets** → **+ New client secret**.
2. Update `.env` → restart `npm run dev`.
3. Once confirmed working, delete the old secret row in the portal.

## Production notes

Production deployments set `APP_URL` to the real HTTPS origin and register that origin's `/auth/callback` as an additional redirect URI on the same app registration (or a separate prod-only registration — preferred). `AUTH_SESSION_SECRET` is rotated via the env store, never reused across environments. See `docs/superpowers/specs/2026-04-19-entra-id-auth-design.md` for the full architecture spec.

## References

- [MSAL Node docs](https://learn.microsoft.com/entra/msal/node/)
- [Entra ID authentication flows](https://learn.microsoft.com/entra/identity-platform/authentication-flows-app-scenarios)
- [App Roles in Entra ID](https://learn.microsoft.com/entra/identity-platform/howto-add-app-roles-in-apps)
- [M365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program)
- Design spec in this repo: `docs/superpowers/specs/2026-04-19-entra-id-auth-design.md`
