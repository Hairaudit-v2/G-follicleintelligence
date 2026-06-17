# FI OS cron authentication standard

Centralized Bearer authentication for Financial OS and payment reminder cron routes via `src/lib/security/validateCronAuth.ts`.

---

## Accepted environment variables

The helper accepts **any one** of these deployment secrets when sent as `Authorization: Bearer <value>`:

| Variable | Purpose |
|----------|---------|
| **`CRON_SECRET`** | **Primary** — Vercel Cron injects this automatically for scheduled jobs |
| **`FINANCIAL_OS_CRON_SECRET`** | Optional dedicated secret for Financial OS automation routes |
| **`FI_PAYMENTS_CRON_SECRET`** | Optional dedicated secret for payment reminder cron |

Rules:

- Each value must be **at least 16 characters** (same minimum as other cron/webhook secrets).
- Empty, whitespace-only, or too-short values are ignored.
- Duplicate values across env vars are deduplicated.
- Comparison is **timing-safe** (`timingSafeUtf8Equal`).

**Recommendation:** Set **`CRON_SECRET`** in Vercel and use it as the single source of truth for all FI OS cron schedules. Keep `FINANCIAL_OS_CRON_SECRET` / `FI_PAYMENTS_CRON_SECRET` only when you need rotation or scoped manual ops keys.

---

## Routes using this helper

| Route | Methods |
|-------|---------|
| `/api/cron/financial-os/automation` | `GET`, `POST` |
| `/api/cron/financial-os/pathway-task-escalation` | `GET`, `POST` |
| `/api/cron/financial-os/clearance-snapshots` | `GET`, `POST` |
| `/api/cron/fi-payments/reminders` | `GET`, `POST` |

Other cron routes (reminders, HR sync, photo-protocol alerts) still use `assertCronAuthorized` with route-specific secrets until migrated separately.

---

## How Vercel Cron calls routes

1. Define jobs in **`vercel.json`** or **Vercel Dashboard → Cron Jobs** with a path (and optional query string).
2. Vercel invokes the route (typically **GET**) on schedule.
3. Vercel adds **`Authorization: Bearer <CRON_SECRET>`** using the project env var **`CRON_SECRET`**.
4. The route calls `validateCronAuth(req)`; on success it runs the existing job logic unchanged.

Example schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/financial-os/clearance-snapshots?dry_run=1",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Ensure **`CRON_SECRET`** is set in the same Vercel environment (Production / Preview) as the deployment running the cron.

---

## Manual testing (PowerShell)

Replace placeholders with your deployed URL and secret.

### Successful call

```powershell
$secret = $env:CRON_SECRET
$url = "https://your-app.vercel.app/api/cron/fi-payments/reminders?dryRun=1"
Invoke-RestMethod -Uri $url -Method GET -Headers @{ Authorization = "Bearer $secret" }
```

Financial OS automation example:

```powershell
$url = "https://your-app.vercel.app/api/cron/financial-os/automation?job=deposit_overdue&dry_run=1"
Invoke-RestMethod -Uri $url -Method GET -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

### Expected 401 failure test

```powershell
$url = "https://your-app.vercel.app/api/cron/fi-payments/reminders?dryRun=1"
try {
  Invoke-WebRequest -Uri $url -Method GET -Headers @{ Authorization = "Bearer wrong-secret-123456" }
} catch {
  $_.Exception.Response.StatusCode.value__  # should be 401
  $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
  $reader.ReadToEnd()  # {"error":"Unauthorized"}
}
```

Or without a header:

```powershell
try {
  Invoke-WebRequest -Uri $url -Method GET
} catch {
  $_.Exception.Response.StatusCode.value__  # 401
}
```

---

## Unauthorized response shape

When `validateCronAuth` returns `false`, routes respond with:

```json
{ "error": "Unauthorized" }
```

HTTP status **401**.

Secrets are never included in responses, logs from the helper, or error messages.

---

## Implementation reference

```typescript
import { validateCronAuth } from "@/src/lib/security/validateCronAuth";

if (!validateCronAuth(req)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Unit tests: `src/lib/security/validateCronAuth.test.ts`.
