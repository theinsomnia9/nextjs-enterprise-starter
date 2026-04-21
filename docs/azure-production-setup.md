# Azure Production Environment Setup (DevOps Runbook)

**Audience:** DevOps / platform engineers provisioning this app's **production** (and staging) environment in Azure. Assumes the person running it has Owner/Contributor on the target subscription and Global Admin (or Application Admin + Cloud App Admin) on the target Entra tenant.

**Primary focus:** Authentication. Secondary: secret storage (Key Vault), secret injection, the database, outbound dependencies, and the handful of deployment-time guardrails that keep auth working.

**Scope:** This runbook does not pick a compute host for you — the app is a stock Next.js 16 server (Node 20 LTS) and runs equally well on Azure App Service (Linux), Azure Container Apps, AKS, or a containerized VM. Where the compute choice changes a step (e.g., Managed Identity binding), the runbook calls it out per platform.

Estimated time: 45–90 minutes the first environment, ~20 minutes for each subsequent one. If you're setting up staging and prod, do prod first, then clone with different names — most values diverge only in URLs and secret rotation schedules.

---

## 1. At-a-glance checklist

Hand this to whoever is tracking the rollout:

- [ ] Entra ID app registration created (prod)
- [ ] Redirect URIs registered (both, HTTPS only):
  - [ ] `https://<prod-host>/auth/callback` — OAuth callback
  - [ ] `https://<prod-host>/auth/signin` — `post_logout_redirect_uri` target (see §3.1)
- [ ] Client secret (or certificate) issued; expiry recorded in rotation calendar
- [ ] App roles defined with **exact** values `Admin`, `User`
- [ ] Enterprise app created; **Assignment required** decision made (see §3.6)
- [ ] Admin consent granted for `User.Read` (Microsoft Graph, Delegated)
- [ ] Initial role assignments made to break-glass admins
- [ ] Key Vault provisioned in same region as compute
- [ ] Key Vault network access decided (public + firewall, selected networks, or Private Endpoint — see §4.5)
- [ ] Key Vault diagnostic logging shipped to Log Analytics (see §4.6)
- [ ] Secrets loaded into Key Vault (see §4.2 table)
- [ ] Compute identity (Managed Identity preferred) granted **Key Vault Secrets User** on the vault
- [ ] App settings / env vars wired to Key Vault references (see §5)
- [ ] Azure Database for PostgreSQL Flexible Server provisioned; connection string stored in Key Vault
- [ ] Private networking decided (public + firewall, VNet integration, or Private Endpoint)
- [ ] Prisma `migrate deploy` executed against prod DB (not `migrate dev`)
- [ ] Conditional Access policies reviewed (MFA, device compliance)
- [ ] Diagnostic logs / OTEL endpoint reachable from compute
- [ ] Post-deploy smoke test: sign in end-to-end as a test user of each role, then federated sign-out
- [ ] Secret rotation runbook scheduled (calendar / PagerDuty / ITSM)

---

## 2. Source of truth

These three docs, in this repo, are the authoritative contract between the app and the platform:

| File | What it tells you |
|---|---|
| `docs/entra-id-local-setup.md` | Walks a developer from zero to working local sign-in. Mirrors steps 3.1–3.7 below but with looser prod defaults. Use as cross-reference if a portal label has moved. |
| `docs/superpowers/specs/2026-04-19-entra-id-auth-design.md` | Full design spec for the auth stack: flow diagrams, runtime split, session payload shape, sliding expiration, known limitations. **Read the "Production notes" and "Known limitation" sections before rollout.** |
| `CLAUDE.md` → "Environment Setup" | Canonical env var list for developers. Every variable there must exist in prod too (or be explicitly waived per §4.2). |

If any of the below conflicts with those three files, those files win — they travel with the code. File an issue + update this runbook.

---

## 3. Entra ID — App Registration

All Entra work happens in the **target tenant** (the Entra directory that holds the end users who will sign in). If that tenant is different from the subscription that hosts the compute, that's fine — Entra tenancy and Azure subscription billing are separate concepts.

### 3.1 Create the app registration

Azure Portal → **Microsoft Entra ID** → **App registrations** → **+ New registration**.

| Field | Value |
|---|---|
| **Name** | `<app-name>-prod` (e.g., `nextjs-boilerplate-prod`). Use a different name per environment — sharing registrations across envs blurs redirect URIs and secrets. |
| **Supported account types** | **Accounts in this organizational directory only (Single tenant)**. The code assumes single-tenant authority (`https://login.microsoftonline.com/${tenantId}`). Multi-tenant is an explicit non-goal in the design spec. |
| **Redirect URI** | Platform **Web**, value `https://<prod-host>/auth/callback`. HTTPS is non-negotiable in prod — `src/lib/auth/cookies.ts` toggles cookie `Secure=true` based on `APP_URL.startsWith('https://')`. Non-HTTPS URLs will ship session cookies over plaintext. **Add a second redirect URI: `https://<prod-host>/auth/signin`** — this is the `post_logout_redirect_uri` target for federated sign-out (§3.3). Entra validates the post-logout URI against the registered list; omit it and Microsoft strands users on its own generic "you signed out" page. |

Click **Register**. Capture from the **Overview** page:

- **Application (client) ID** → destined for env `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → destined for env `AZURE_AD_TENANT_ID`

**CLI equivalent** (both URIs in one call — az overwrites the list, so always pass all URIs you intend to keep):

```bash
az ad app update \
  --id <AZURE_AD_CLIENT_ID> \
  --web-redirect-uris \
    "https://<prod-host>/auth/callback" \
    "https://<prod-host>/auth/signin"
```

### 3.2 Client secret OR certificate (pick one)

**Recommended for prod: certificate credential.** Client secrets are faster to set up but must be rotated and re-deployed manually; certificates can be rotated in Key Vault and referenced by thumbprint. The app currently uses a client secret (`src/lib/auth/msal.ts`), so:

**If you stick with a client secret (acceptable for v1):**

1. App registration → **Certificates & secrets** → **+ New client secret**.
2. Description: `prod-<YYYYMMDD>`. Expiry: **6 months maximum.** (Entra UI offers 24 months; do not take it. Long-lived bearer credentials are the #1 cause of prod auth outages.)
3. Immediately copy the **Value** column. This is only visible once. Paste it into Key Vault (§4) before closing the tab.
4. Add the expiry date to whatever calendar / alerting system the team uses. Target rotation **4 weeks before expiry** — not the day-of.

**If you upgrade to a certificate (recommended follow-up):**

1. Generate a cert (e.g., via Key Vault → Certificates → Generate) using RSA 2048 or higher.
2. Upload the **public key** (`.cer`) to the app registration → **Certificates & secrets** → **Certificates** tab.
3. The app code (`src/lib/auth/msal.ts`) must be updated to consume `clientCertificate: { thumbprint, privateKey }` instead of `clientSecret`. File a follow-up ticket; this runbook flags the upgrade but does not ship the code change.

### 3.3 Authentication settings

App registration → **Authentication**.

- **Redirect URIs (Web)**: confirm **both** URIs are present:
  - `https://<prod-host>/auth/callback` — OAuth2 authorization-code callback.
  - `https://<prod-host>/auth/signin` — `post_logout_redirect_uri` for federated sign-out. The `/auth/signout` route redirects to Entra's end-session endpoint with this URI; Entra validates it against this list before redirecting back. If it's missing, the user lands on Microsoft's generic "signed out" page with no return path.
  - Add staging origins to a **separate** staging registration — do not share.
- **Front-channel logout URL**: leave blank. This is for SAML-style IdP-initiated logout in federation scenarios, which the app does not use. Our sign-out is RP-initiated via the OIDC end-session endpoint (see §3.3.1 below) — not related to this field.
- **Implicit grant and hybrid flows**: both checkboxes **unchecked**. The code uses Authorization Code + PKCE (`src/app/auth/signin/route.ts`), not implicit.
- **Advanced settings → Allow public client flows**: **No**. This is a confidential client.
- **Advanced settings → Supported account types**: leave at single tenant (set at registration time).

Save.

#### 3.3.1 Federated sign-out flow (reference)

When a user clicks **Sign out** in the app, the following happens. Keep this in the team's mental model when debugging auth issues:

1. Browser navigates to `GET /auth/signout` (our route).
2. Route clears the encrypted app session cookie **and** sets a short-lived `post_logout` flag cookie (scoped to `/auth/signin`, 5 min TTL), then 302s to:
   ```
   https://login.microsoftonline.com/<tenant>/oauth2/v2.0/logout
     ?post_logout_redirect_uri=https://<prod-host>/auth/signin
     &client_id=<AZURE_AD_CLIENT_ID>
   ```
3. Entra tears down the tenant session and (for accounts linked to multiple tenants) may show an account picker — this is Microsoft's UI, not the app's.
4. Entra redirects the browser to `https://<prod-host>/auth/signin` (the `post_logout_redirect_uri`).
5. `/auth/signin` sees the `post_logout` cookie, adds `prompt=login` to the MSAL authorize request, and clears the cookie. This forces Entra to re-prompt for credentials on the next sign-in — **without it, Entra's top-level SSO cookie can silently re-issue a code, making sign-out appear to fail** (user bounces back still signed in).
6. User lands on the Microsoft sign-in form. If they sign back in, a fresh session cookie is minted.

**Implementation files:** `src/app/auth/signout/route.ts`, `src/app/auth/signin/route.ts`, `src/lib/auth/cookies.ts` (look for `POST_LOGOUT_COOKIE`).

**Testing this in prod smoke:** see §9 step 6. The federated logout is observable as a 302 chain ending at `login.microsoftonline.com/.../oauth2/v2.0/logout`, followed by the user re-hitting `/auth/signin` and being forced to authenticate (Microsoft UI visible).

### 3.4 Token configuration (optional — recommended)

App registration → **Token configuration** → **+ Add optional claim**.

- **Token type: ID** → add **email** and **preferred_username**. The code reads `claims.preferred_username` for email at `src/app/auth/callback/route.ts:121`. If Entra omits this claim in your tenant (unusual, but happens with synced on-prem AD accounts), `email` will be null on new users — not fatal, but unfriendly. Adding the optional claim closes the gap.

### 3.5 API permissions

App registration → **API permissions**. You want exactly one:

| API | Permission | Type | Why |
|---|---|---|---|
| Microsoft Graph | `User.Read` | **Delegated** | Profile photo fetched once at sign-in (`src/lib/auth/graph.ts`). No other Graph traffic. |

Remove any extras (e.g., `openid profile email offline_access` — those are OIDC scopes, not Graph permissions, and live on the request, not the registration).

Click **Grant admin consent for <tenant>** → **Yes**. Status column must show a green checkmark. Without consent, first sign-in surfaces `AADSTS65001`.

### 3.6 App roles (authorization surface)

App registration → **App roles** → **+ Create app role**. Create both. **The `Value` field is case-sensitive and must match exactly** — the code in `src/lib/auth/roles.ts` compares as literal strings, and unknown values get silently filtered to `User` with a warn log.

| Display name | Allowed member types | Value | Description |
|---|---|---|---|
| Admin | Users/Groups | `Admin` | Privileged actions; gate admin-only features on this role. |
| User | Users/Groups | `User` | Standard signed-in user. Default if no explicit assignment. |

Each must have **Do you want to enable this app role?** checked.

> **Important:** The app reads roles from the **ID token**, not the access token, not Graph. This means role changes only take effect on next sign-in (or on the sliding-refresh boundary — up to 12 hours; see `docs/superpowers/specs/…-auth-design.md` → "Known limitation"). If instant revocation is a compliance requirement, that's a known gap and requires a design change — flag to product, don't paper over it here.

### 3.7 Enterprise application configuration

Creating the app registration auto-provisions a matching **Enterprise application** in the same tenant. Find it via **Microsoft Entra ID → Enterprise applications → <your app name>**.

**Properties:**

- **Assignment required?** — policy decision:
  - **Yes** → only users/groups explicitly assigned can sign in. Unauthorized tenant members get `AADSTS50105`. Prefer this for internal tools with a clear user list.
  - **No** → any tenant member can sign in and lands as `User` by default. Lower friction, higher blast radius. Acceptable for internal dev/staging; flip to **Yes** for prod based on your org's policy.
- **Visible to users?** — **Yes** only if you want it in the user's My Apps portal. Typically **No** for internal tools launched via a deep link.

**Users and groups:**

- Assign the break-glass admin(s) to `Admin` immediately. Do this before you hand anyone the URL. An app with no `Admin` users is functional but un-administerable from the UI for any feature gated on `Admin`.
- For ongoing role assignment at scale, **Group-based assignment requires Entra ID P1 or higher** (not in Free/P2). If you're on Free, individual user assignment is the only option and must be done per-user.

**Conditional Access (strongly recommended):**

Enterprise applications → **Conditional Access**. At minimum enable:

- **Require MFA** for this app, or rely on a tenant-wide policy that already covers it.
- **Block legacy auth** (tenant-wide — if not already set).
- Optionally: **Compliant/hybrid-joined device** if the user population is managed.

If your tenant uses risk-based policies, add this app to their scope. CAE (Continuous Access Evaluation) is a non-goal for v1 per the design spec but becomes attractive once instant revocation matters — note it on the roadmap.

### 3.8 Verification before moving on

Before leaving Entra, sanity-check:

```
GET https://login.microsoftonline.com/<AZURE_AD_TENANT_ID>/.well-known/openid-configuration
```

This should return a JSON discovery document. If you get a 400 or HTML, the tenant ID is wrong. Save the four values (client ID, tenant ID, client secret value, redirect URI) somewhere short-lived until they land in Key Vault in §4.

---

## 4. Azure Key Vault — secret storage

**Do not set app secrets directly as env vars on the compute resource's "Configuration" blade.** App Service and Container Apps both support Key Vault references; use them. This gives you:

- Centralized rotation (rotate in Key Vault, no re-deploy).
- Audit trail (who read which secret, when) via Azure Monitor.
- RBAC separation (ops can edit secrets; devs can't).

### 4.1 Provision the vault

```bash
az keyvault create \
  --name kv-<app>-<env>-<region-short> \
  --resource-group rg-<app>-<env> \
  --location <same-region-as-compute> \
  --enable-rbac-authorization true \
  --enable-soft-delete true \
  --retention-days 90 \
  --enable-purge-protection true
```

Notes:
- Name must be globally unique (3–24 alphanumerics + hyphens).
- `--enable-rbac-authorization true` — use Azure RBAC, not legacy access policies. Less footgun-prone.
- `--enable-purge-protection true` — once on, **cannot be turned off**. That's the point: a compromised admin can't `purge` to cover their tracks. Non-negotiable for prod.
- Region must match compute to avoid cross-region egress + latency on every cold start. Multi-region = multi-vault.

### 4.2 Secrets to store

Create one Key Vault secret per row. Secret names use hyphens (Key Vault disallows underscores).

| Key Vault secret | App env var | Required? | Source |
|---|---|---|---|
| `azure-ad-client-id` | `AZURE_AD_CLIENT_ID` | **Yes** | Entra step 3.1 |
| `azure-ad-tenant-id` | `AZURE_AD_TENANT_ID` | **Yes** | Entra step 3.1 |
| `azure-ad-client-secret` | `AZURE_AD_CLIENT_SECRET` | **Yes** | Entra step 3.2 (value, not secret ID) |
| `auth-session-secret` | `AUTH_SESSION_SECRET` | **Yes** | `openssl rand -base64 48` (see §4.3) |
| `app-url` | `APP_URL` | **Yes** | e.g., `https://<prod-host>` — **no trailing slash** |
| `database-url` | `DATABASE_URL` | **Yes** | Azure Postgres connection string (see §6) |

Non-secret env vars — set these directly on compute, **not** in Key Vault (they're checked into operational config, not credentials):

| Env var | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | same as `APP_URL` (this one is baked into the client bundle; any `NEXT_PUBLIC_*` ends up in HTML) |
| `OTEL_SERVICE_NAME` | `nextjs-boilerplate` |
| `OTEL_SERVICE_VERSION` | build tag (git SHA or semver) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | your OTel collector (e.g., Azure Monitor OTel bridge or internal Grafana stack) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` |
| `OTEL_TRACES_SAMPLER` | `parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | `0.1` or `1.0` depending on cost appetite |
| `NEXT_PUBLIC_YJS_HOST` / `NEXT_PUBLIC_YJS_PORT` | only if you run the collaborative-canvas feature; otherwise omit |

### 4.3 Generating `AUTH_SESSION_SECRET`

This is the HKDF input that derives the AES-256-GCM key that encrypts every session cookie. If this leaks, every active session is decryptable and forgeable.

```bash
openssl rand -base64 48
```

Rules:
- **Minimum 32 characters** — code throws at module load if shorter (`src/lib/auth/config.ts:21`).
- **Generate fresh per environment.** Never reuse between prod, staging, dev, CI. Reuse means a staging cookie is a valid prod cookie.
- **Store only in Key Vault.** Do not put it in Terraform state, CI variables, or Slack. If Terraform must know about it, use an `az_key_vault_secret` data source so the value lives only in the vault.

### 4.4 Rotation schedule

| Secret | Rotation cadence | How to rotate |
|---|---|---|
| `azure-ad-client-secret` | Every 4 months (targeting 4 weeks before 6-month expiry) | Entra portal → new secret → update Key Vault → no restart needed if using Key Vault references with auto-reload; restart compute otherwise → delete old secret in Entra after 24h soak |
| `auth-session-secret` | Every 6 months, **or immediately on suspected compromise** | New value in Key Vault → compute picks it up → **all users are logged out** on next request (existing cookies fail to decrypt). Communicate before rotating. |
| `database-url` password | Every 6 months | Azure Postgres → rotate server admin password → update connection string in Key Vault → graceful rollout |
| `openai-api-key` / `tavily-api-key` | At vendor's recommendation or on suspected leak | Vendor console → Key Vault → compute reload |
| `cron-secret` | Every 12 months | `openssl rand -hex 32` → Key Vault → update whatever invokes the cron endpoints with the new value → compute reload |

Document rotation dates in a shared calendar. Entra does **not** proactively warn before a secret expires — it just starts returning `AADSTS7000215: Invalid client secret` at 00:00 UTC on expiry day, and the app goes cold.

### 4.5 Networking

Default `az keyvault create` opens the data plane to the public internet and relies on RBAC + TLS for protection. That is **acceptable** but not ideal for prod. Pick one of three postures and stick with it across environments.

**Option A — Public access + selected networks (minimum acceptable).** Vault has a public FQDN but a firewall allow-list.

```bash
az keyvault network-rule add \
  --name kv-<app>-<env>-<region-short> \
  --ip-address <compute-egress-ip>/32

az keyvault update \
  --name kv-<app>-<env>-<region-short> \
  --default-action Deny \
  --bypass AzureServices
```

- `--default-action Deny` is the key step; without it the firewall rules are advisory only.
- `--bypass AzureServices` permits trusted Azure services (e.g., Key Vault references from App Service in the same tenant) when they present a verified Managed Identity. Required if you're using `@Microsoft.KeyVault(…)` references from App Service — remove it only if you can prove every caller is inside your VNet.
- Works only if compute egress IPs are stable. App Service Basic/Standard share a small NAT pool that can change on scale events; prefer Option B for those.

**Option B — VNet + Service Endpoint.** Compute lives in a subnet; that subnet is added to the vault's firewall.

```bash
az keyvault network-rule add \
  --name kv-<app>-<env>-<region-short> \
  --vnet-name vnet-<app>-<env> \
  --subnet snet-compute

az keyvault update \
  --name kv-<app>-<env>-<region-short> \
  --default-action Deny
```

Traffic stays on the Azure backbone, but the vault keeps its public FQDN (requests from outside the allow-list are rejected at the firewall, not dropped at DNS).

**Option C — Private Endpoint (strictest, preferred for regulated workloads).** Vault gets a private IP inside your VNet; the public FQDN resolves to that private IP via Azure Private DNS.

```bash
az network private-endpoint create \
  --name pe-kv-<app>-<env> \
  --resource-group rg-<app>-<env> \
  --vnet-name vnet-<app>-<env> \
  --subnet snet-private-endpoints \
  --private-connection-resource-id $(az keyvault show --name kv-<app>-<env>-<region-short> --query id -o tsv) \
  --group-id vault \
  --connection-name kv-connection

az keyvault update \
  --name kv-<app>-<env>-<region-short> \
  --public-network-access Disabled
```

Requires a `privatelink.vaultcore.azure.net` Private DNS zone linked to the VNet. If that's missing, `kv-*.vault.azure.net` resolves to the public IP and the connection is refused. This is the #1 cause of "it works in dev, breaks in prod" with Private Endpoint — verify DNS resolution from inside the VNet with `nslookup kv-<app>-<env>-<region-short>.vault.azure.net` before flipping `--public-network-access Disabled`.

**Whichever you pick:** record the choice in the env runbook so on-call can distinguish a network outage (DNS/firewall) from an RBAC outage (403 from the data plane).

### 4.6 Diagnostic logging

Key Vault emits two diagnostic log categories. Ship both to Log Analytics (or an archival storage account) for audit compliance.

```bash
# Create a dedicated workspace if one doesn't exist per env
az monitor log-analytics workspace create \
  --resource-group rg-<app>-<env> \
  --workspace-name log-<app>-<env>

# Attach diagnostics to the vault
az monitor diagnostic-settings create \
  --name kv-audit \
  --resource $(az keyvault show --name kv-<app>-<env>-<region-short> --query id -o tsv) \
  --workspace $(az monitor log-analytics workspace show --resource-group rg-<app>-<env> --workspace-name log-<app>-<env> --query id -o tsv) \
  --logs '[
    {"category": "AuditEvent", "enabled": true, "retentionPolicy": {"enabled": true, "days": 365}},
    {"category": "AzurePolicyEvaluationDetails", "enabled": true, "retentionPolicy": {"enabled": true, "days": 90}}
  ]' \
  --metrics '[{"category": "AllMetrics", "enabled": true, "retentionPolicy": {"enabled": true, "days": 30}}]'
```

What each category captures:

- **`AuditEvent`** (landed in `AzureDiagnostics` / `KeyVaultAuditLogs` table) — every data-plane operation: secret reads, writes, deletes, plus control-plane changes. This is the forensic log. Keep for ≥1 year for most compliance regimes.
- **`AzurePolicyEvaluationDetails`** — Azure Policy evaluations against the vault. Useful for proving policy compliance (e.g., "vault must have purge protection on"). Keep for the audit cycle (typically 90 days).
- **`AllMetrics`** — availability, saturation, throttling. Feed into alerting.

Sample KQL queries for the "did we just get breached?" moment — save these as workbook queries:

```kql
// Unusual reader identities over the last hour
KeyVaultAuditLogs
| where TimeGenerated > ago(1h)
| where OperationName == "SecretGet"
| summarize count() by identity_claim_appid_g, identity_claim_oid_g
| order by count_ desc

// Failed accesses (403s) — often the first signal of a misconfigured reader or an intruder
KeyVaultAuditLogs
| where TimeGenerated > ago(24h)
| where ResultSignature startswith "Forbidden"
| project TimeGenerated, CallerIpAddress, identity_claim_oid_g, OperationName, Resource
```

**Alerts worth creating:**

- Secret read from an IP outside the expected compute egress range.
- Control-plane op (`SecretDelete`, `VaultDelete`, role assignment change) outside change-window.
- Rate of `Forbidden` responses exceeds a baseline (indicator of either misconfig during a deploy or a brute-force attempt).

### 4.7 Backup & recovery mechanics

Recovery hinges on two features enabled at vault creation (§4.1): **soft-delete** and **purge protection**.

- **Soft-deleted secret** — recoverable within the retention window (90 days recommended):

  ```bash
  az keyvault secret recover \
    --vault-name kv-<app>-<env>-<region-short> \
    --name azure-ad-client-secret
  ```

- **Soft-deleted vault** — recoverable until retention expires:

  ```bash
  az keyvault recover --name kv-<app>-<env>-<region-short> --location <region>
  ```

- **With purge protection on, neither a compromised admin nor a misclick can force-delete before retention expires.** That's the design goal. It also means you cannot "start over" by purging + recreating — plan the vault name and region once.

- **Cross-region DR**: Key Vault is a single-region resource. For multi-region DR, maintain a mirror vault in the paired region and replicate secret *writes* via your rotation process (not by copying Azure Backup snapshots — those don't exist for Key Vault). Most single-region apps don't need this; flag it only if your compliance regime mandates a regional failover capability.

---

## 5. Compute identity & secret injection

The compute host needs to read from Key Vault. Do **not** give it a client secret or connection string for the vault — use **Managed Identity**.

### 5.1 Managed Identity (platform-specific)

**App Service / Container Apps:**

```bash
# System-assigned identity — simpler, 1:1 with the resource
az webapp identity assign \
  --name app-<name>-<env> \
  --resource-group rg-<name>-<env>

# OR for Container Apps
az containerapp identity assign \
  --name ca-<name>-<env> \
  --resource-group rg-<name>-<env> \
  --system-assigned
```

Capture the output's `principalId`.

**AKS:** use **Workload Identity** (federates a Kubernetes ServiceAccount to an Entra identity). Separate runbook — out of scope here.

**Plain VM / VMSS:** `az vm identity assign`.

### 5.2 Grant the identity access to the vault

```bash
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <principalId-from-above> \
  --scope $(az keyvault show --name kv-<app>-<env>-<region-short> --query id -o tsv)
```

`Key Vault Secrets User` grants **read-only** access to secret values. That's all the app needs. Never give the app `Key Vault Administrator` or `Key Vault Secrets Officer` — those can write/delete.

### 5.3 Key Vault references in app settings

**App Service / Container Apps:** each env var points at a Key Vault secret URI. The platform resolves it at boot (and on secret version change if you use the version-less URI).

Syntax:

```
@Microsoft.KeyVault(SecretUri=https://kv-<app>-<env>-<region>.vault.azure.net/secrets/azure-ad-client-secret/)
```

Or, equivalently:

```
@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=azure-ad-client-secret)
```

Omit the version segment to get auto-refresh on rotation. Include it only if you need to pin.

**Set via CLI:**

```bash
az webapp config appsettings set \
  --name app-<name>-<env> \
  --resource-group rg-<name>-<env> \
  --settings \
    AZURE_AD_CLIENT_ID="@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=azure-ad-client-id)" \
    AZURE_AD_TENANT_ID="@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=azure-ad-tenant-id)" \
    AZURE_AD_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=azure-ad-client-secret)" \
    AUTH_SESSION_SECRET="@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=auth-session-secret)" \
    APP_URL="@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=app-url)" \
    DATABASE_URL="@Microsoft.KeyVault(VaultName=kv-<app>-<env>-<region>;SecretName=database-url)" \
    NODE_ENV=production \
    NEXT_PUBLIC_APP_URL="https://<prod-host>"
```

### 5.4 Verify resolution

After the app boots:

```bash
az webapp config appsettings list \
  --name app-<name>-<env> \
  --resource-group rg-<name>-<env> \
  --query "[?name=='AZURE_AD_CLIENT_SECRET'].{name:name, slotSetting:slotSetting}"
```

Then in the portal's **Configuration** blade, each Key Vault reference shows a green checkmark if resolved, red "X" if not. Red = Managed Identity lacks access (re-check §5.2) or the secret name has a typo (Key Vault is case-sensitive).

---

## 6. Database — Azure Database for PostgreSQL (Flexible Server)

The Prisma schema targets Postgres. Use **Flexible Server**, not Single Server (the latter is being retired).

### 6.1 Provision

```bash
az postgres flexible-server create \
  --name pg-<app>-<env> \
  --resource-group rg-<app>-<env> \
  --location <same-region-as-compute> \
  --tier GeneralPurpose \
  --sku-name Standard_D2ds_v5 \
  --storage-size 128 \
  --version 16 \
  --admin-user appadmin \
  --admin-password "$(openssl rand -base64 24)" \
  --high-availability ZoneRedundant \
  --backup-retention 14 \
  --geo-redundant-backup Disabled
```

Tune the SKU and backup settings to your load/compliance budget. Postgres 16 is supported by Prisma 5.x (the version in `package.json`).

Capture the connection string:

```
postgresql://appadmin:<password>@pg-<app>-<env>.postgres.database.azure.com:5432/postgres?sslmode=require
```

Store that as `database-url` in Key Vault. Do **not** use `sslmode=disable`; Flexible Server requires TLS by default and downgrading it is a compliance red flag.

### 6.2 Connectivity model

Pick one and stick with it across environments:

- **Public access + firewall rules** — simplest; allow the compute's outbound IPs. Use only if egress IPs are stable (App Service Basic/Standard have a small pool; Container Apps need a dedicated workload profile).
- **VNet integration + Private DNS** — compute lives in a subnet with service endpoints or Private Endpoint to the DB. Preferred for prod. Requires the DB to be created with `--public-access Disabled --vnet` flags (different CLI invocation than the above).
- **Private Endpoint** — strictest. DB has no public FQDN at all; reachable only through the endpoint.

Whatever you pick, document it in the env's runbook so on-call knows what "can't connect to DB" looks like (firewall hit vs DNS vs endpoint outage).

### 6.3 Run migrations

Before the app receives traffic:

```bash
DATABASE_URL="<prod-connection-string>" npx prisma migrate deploy
DATABASE_URL="<prod-connection-string>" node prisma/seed.js
```

- Use `migrate deploy`, **not** `migrate dev`. Deploy applies committed migrations only and does not ask for input.
- The seed is safe to re-run (upserts PriorityConfig rows; does not create users).
- Run this from a trusted admin workstation or a one-shot migration job, not from the app container at startup — startup migrations make rollbacks painful.

Users are provisioned at first sign-in (`prisma.user.upsert({ where: { entraOid } })` in `src/app/auth/callback/route.ts`). The seed intentionally does not touch the User table.

### 6.4 Prisma at runtime

The app runs `@prisma/client` at runtime but not `prisma` (the CLI). Make sure the Docker/App Service build step runs `npx prisma generate` (it's implicit via `npm run build` if the build script is invoked, but explicit is safer in Dockerfiles).

---

## 7. Outbound network dependencies

If the compute lives in a locked-down VNet, explicitly allow egress to:

| Host | Purpose | Port |
|---|---|---|
| `login.microsoftonline.com` | Authorization Code + token exchange | 443 |
| `login.microsoft.com` | MSAL metadata (occasional) | 443 |
| `graph.microsoft.com` | Profile photo fetch at sign-in | 443 |
| `*.postgres.database.azure.com` (or private endpoint) | Database | 5432 |
| `api.openai.com` | Chat + agent | 443 |
| `api.tavily.com` | Agent web-search tool | 443 |
| Your OTel collector endpoint | Telemetry | 4318 (or whatever) |

Blocking any of the first three will break sign-in.

---

## 8. Deployment-time guardrails

These are the ones that actually bite in prod. Verify each during the first deploy.

1. **`APP_URL` has no trailing slash.** `src/lib/auth/config.ts:20` strips one if present, but a URL like `https://host.com//auth/callback` in the Entra portal vs `https://host.com/auth/callback` in the app = `AADSTS50011` loop. Make both exact matches.

2. **`APP_URL` uses `https://`.** Cookie `Secure` flag is computed from `APP_URL.startsWith('https://')` (`src/lib/auth/cookies.ts:11`). If `APP_URL` is `http://...` in prod, cookies go out without `Secure`. TLS termination in front of the app does not help — the runtime reads the env var, not the inbound protocol.

3. **Prod registration is separate from staging/dev.** Sharing a registration means sharing the client secret, sharing redirect URIs, and any change in one env is felt in the others. One registration per environment.

4. **Break-glass admin exists and is tested before launch.** An app with `Assignment required: Yes` and zero `Admin` assignments is unrecoverable from within the app UI. Assign at least two independent humans to `Admin` before go-live and sign each one in once.

5. **Session TTL and sliding refresh are not environment-configurable.** Hard-coded to 12 hours and 6-hour sliding in `src/lib/auth/config.ts`. If compliance requires shorter, that's a code change, not a config change — file it early.

6. **Role revocation is not instant.** Design spec "Known limitation": role changes in Entra propagate at next sign-in or the sliding-refresh boundary (up to 12h). If an employee is terminated, disabling the user in Entra does not immediately kill their session. If that's unacceptable, shorten `sessionTtlSeconds` via code change, or migrate to DB-backed sessions (bigger change).

7. **Post-logout redirect URI must be registered in Entra.** The Entra app registration must list **both** `https://<prod-host>/auth/callback` **and** `https://<prod-host>/auth/signin` under **Web → Redirect URIs** (§3.1, §3.3). If only the callback is registered, federated sign-out strands users on Microsoft's generic "You signed out of your account" page with no path back to the app — the sign-out appears to succeed but the user experience is broken. Verify by running `az ad app show --id <AZURE_AD_CLIENT_ID> --query "web.redirectUris"` after deploy; both URIs must be in the list.

8. **`post_logout` cookie behavior across replicas.** The cookie that tells `/auth/signin` to force `prompt=login` (§3.3.1) is set by `/auth/signout` and read on the next `/auth/signin` hit. Because the cookie lives in the browser, not server memory, this works across replicas. If you front-door across replicas, verify the `post_logout` cookie survives the redirect chain (scoped `Path=/auth/signin`, `SameSite=Lax` — a cross-site referer during the `login.microsoftonline.com` → `/auth/signin` hop will still send it, but verify in DevTools on first prod deploy).

---

## 9. Post-deploy smoke test

Run through this after the first prod deploy, with a notebook open:

1. `curl -I https://<prod-host>/` → expect `302 Location: /auth/signin?returnTo=/`.
2. Click through `/auth/signin`. Verify redirect to `login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize?...`.
3. Sign in as each break-glass user (one Admin, one plain User).
4. After redirect back, DevTools → Application → Cookies → `session` cookie present with `HttpOnly: true`, `Secure: true`, `SameSite: Lax`, `Path: /`.
5. Hit any protected route → loads (no redirect loop).
6. **Federated sign-out end-to-end.** From any protected page, click **Sign out** (or `curl -I -b session=<cookie> https://<prod-host>/auth/signout`). Expect a 302 chain:
   - `/auth/signout` → `Set-Cookie: session=; Max-Age=0` + `Set-Cookie: post_logout=1; Path=/auth/signin; Max-Age=300` → `Location: https://login.microsoftonline.com/<tenant>/oauth2/v2.0/logout?post_logout_redirect_uri=https://<prod-host>/auth/signin&client_id=<client-id>`.
   - Microsoft logout page (may show account picker) → `Location: https://<prod-host>/auth/signin`.
   - `/auth/signin` sees the `post_logout` cookie, builds the authorize URL with `&prompt=login`, clears the cookie (`Max-Age=0`), and redirects to `login.microsoftonline.com/.../oauth2/v2.0/authorize`.
   - User is forced to re-enter credentials (not silently re-authenticated). If the authorize URL lacks `prompt=login`, the `post_logout` cookie wasn't read — see §3.3.1.
   - Any subsequent protected request before re-sign-in returns 302 to `/auth/signin`.
7. Check the database: `SELECT entraOid, email, image IS NOT NULL as has_photo FROM "User";` — one row per user who signed in.
8. Tamper with the session cookie (change one character) → next request → `302 /auth/signin?error=invalid_session`. This confirms the JWE integrity check is working.
9. Force the cookie to expire (wait, or edit `exp` locally — won't re-decrypt, so just delete it) → `/auth/signin` redirect.
10. Call `/api/cron/expire-locks` without the cron secret → 401; with it → 200.

If any of these fail, do **not** flip traffic. Roll back the deploy and debug against the staging env.

---

## 10. Ongoing ops

- **Entra audit logs**: Entra ID → Monitoring → Sign-in logs / Audit logs. Filter by application ID. Watch for `signInErrorCode` spikes — usually a secret rotation missed a step.
- **Key Vault audit**: enable diagnostic settings on the vault → ship to Log Analytics. `KeyVaultAuditLogs` table tracks every secret read. Unexpected reader = exfil attempt.
- **Session secret rotation drill**: rotate `auth-session-secret` in staging **every quarter** as a fire drill. Confirms the rotation process works before you need it in prod.
- **Redirect URI drift**: if ops ever changes the prod hostname, update the Entra registration **before** cutover, not after. Otherwise every user gets `AADSTS50011`.
- **Conditional Access changes**: if the security team retightens a tenant-wide CA policy (e.g., require managed device), this app inherits it at next sign-in — no code change, but expect a support spike.

---

## 11. Disaster recovery

- **Entra tenant loss** (extremely rare, but): app is hard-down until a new registration exists. There's no way to failover Entra. Keep the tenant ID, client ID, and redirect URI documented in the corporate IT runbook separately — if the tenant admin who registered the app leaves, the next admin needs to find it.
- **Key Vault loss**: soft-deleted secrets are recoverable for 90 days (see §4.1). Purge-protected vaults cannot be permanently deleted by an attacker. Restoring a deleted vault: `az keyvault recover --name <vault> --location <region>`.
- **Session secret compromised**: rotate `auth-session-secret` (§4.4). All users are signed out. Force sign-in with `Require MFA` in CA for the next 24 hours as an extra check.
- **Client secret compromised**: revoke in Entra (`az ad app credential delete`) — this instantly breaks the app's token exchange. Generate a new secret, update Key Vault, redeploy (or let Key Vault reference auto-reload). Expect 5–15 minutes of sign-in downtime.

---

## 12. What's deliberately not here

Out of scope for this runbook:

- Compute host selection (App Service vs Container Apps vs AKS) — pick based on your org's standards.
- CI/CD pipeline wiring — this runbook only describes the target state.
- Traffic management (Front Door, Application Gateway) — app works behind any reverse proxy that forwards the `Cookie` and `Host` headers.
- Multi-region failover — app is single-region; cross-region DR is a separate design.
- B2C / External ID flows — app is employee-facing single-tenant by design.
- Certificate-based MSAL client credentials — flagged in §3.2 as a follow-up.

---

## 13. Contacts & references

- App auth design spec: `docs/superpowers/specs/2026-04-19-entra-id-auth-design.md`
- Local dev parallel: `docs/entra-id-local-setup.md`
- Env var canonical list: `CLAUDE.md` → "Environment Setup"
- MSAL Node docs: https://learn.microsoft.com/entra/msal/node/
- Key Vault references in App Service: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references
- Managed Identity on App Service: https://learn.microsoft.com/azure/app-service/overview-managed-identity
- Postgres Flexible Server: https://learn.microsoft.com/azure/postgresql/flexible-server/
