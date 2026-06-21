# PROJECT NEXUS — FI OS Provisioning API (Phase 9A)

Phase 9A defines the **FI OS-side contract** for IIOHR Nexus to provision certified professionals into FI OS tenants without granting unrestricted production access automatically.

IIOHR Phase **9B** can implement `ProductionAdapter` against these endpoints once both sides share `FI_OS_NEXUS_SECRET` and enable the feature flag in a controlled environment.

---

## Schema

Migration: `supabase/migrations/20260921120006_fi_os_nexus_provisioning_contract.sql`

| Table | Purpose |
|-------|---------|
| `fi_nexus_external_professionals` | Cross-system professional record keyed by `global_professional_id` |
| `fi_nexus_tenant_memberships` | Tenant (and optional site) membership — default `pending` |
| `fi_nexus_staff_profiles` | FI OS staff shell — **inactive by default** |
| `fi_nexus_role_assignments` | Approved roles — idempotent per `(global_professional_id, tenant_id, role_code)` while `active=true` |
| `fi_nexus_provisioning_audit` | Provision/rollback audit trail |

**RLS:** all Nexus tables are **service_role only**. Routes authenticate via HMAC; no public/anon access.

### Indexes

- `global_professional_id` on all tables
- `tenant_id` on memberships, staff profiles, role assignments
- `role_code` on role assignments
- Partial unique index: one active row per `(global_professional_id, tenant_id, role_code)`

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FI_OS_NEXUS_ENABLED` | `false` | Must be `true`/`1`/`yes` or all endpoints return **403** |
| `FI_OS_NEXUS_SECRET` | _(unset)_ | Shared HMAC secret (≥16 chars). Missing/short → **503** |
| `FI_OS_NEXUS_CREATE_AUTH_USER` | `false` | Phase 9A does **not** create `auth.users`. Flag is reserved for a future gated invite flow |

Add to `.env.local` for staging adapter work:

```env
FI_OS_NEXUS_ENABLED=true
FI_OS_NEXUS_SECRET=your_shared_secret_min_16_chars
FI_OS_NEXUS_CREATE_AUTH_USER=false
```

---

## Security model

### HMAC signing

Headers (required on every request):

- `x-iiohr-fi-webhook-timestamp` — Unix seconds (10 digits) or milliseconds (13 digits)
- `x-iiohr-fi-webhook-signature` — HMAC-SHA256 hex digest

**Signature material:**

```
{timestamp}.{rawBody}
```

- **POST** (`provision`, `rollback`): `rawBody` is the exact UTF-8 JSON request body.
- **GET** (`state`): `rawBody` is the raw `globalProfessionalId` query value (no JSON wrapper).

**Validation rules:**

- Reject requests older than **5 minutes** (timestamp skew).
- Compare signatures with **timing-safe** hex comparison.
- Endpoints return **403** when `FI_OS_NEXUS_ENABLED` is not affirmative.
- Endpoints return **503** when secret is missing or too short.

### Production safety (Phase 9A)

- Does **not** auto-create unrestricted Supabase auth users.
- Staff profiles remain **`active=false`** until FI OS activates them through existing operational flows.
- Membership defaults to **`pending`**.
- Rollback only touches rows with **`nexus_created=true`**.

---

## Canonical FI OS Nexus roles

Defined in `src/lib/nexus/fiOsNexusRoles.ts`:

| Role code |
|-----------|
| `surgeon_operator` |
| `consultation_doctor` |
| `theatre_nurse` |
| `procedure_assistant` |
| `consultation_operator` |
| `crm_operator` |
| `fi_admin` |
| `training_observer` |
| `audit_viewer` |

Unknown role codes → **400** with `Invalid role(s): …`.

---

## Endpoint contract

Base path: `/api/nexus/iiohr`

### POST `/provision`

Provisions (idempotent upsert) professional → membership → staff profile → approved roles.

**Response (200):**

```json
{
  "ok": true,
  "state": {
    "professional": { "...": "..." },
    "memberships": [],
    "staffProfiles": [],
    "activeRoles": [],
    "auditCount": 1,
    "reconciliationWarnings": []
  }
}
```

### POST `/rollback`

Revokes Nexus-created role assignments, deactivates Nexus staff profile, sets membership to `revoked`.

**Required body field:** `reason` (non-empty string).

**Response (200):** `{ "ok": true, "state": { ... } }`

### GET `/state?globalProfessionalId={id}`

Returns current Nexus state for reconciliation.

**Response (200):** `{ "ok": true, "state": { ... } }`

---

## Payload contract (provision)

```json
{
  "globalProfessionalId": "iiohr:prof:001",
  "email": "surgeon@clinic.example",
  "name": "Dr Example",
  "professionalType": "hair_surgeon",
  "certificationLevel": "board_certified",
  "deploymentReady": false,
  "sourceSystem": "iiohr",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "siteId": "00000000-0000-4000-8000-000000000002",
  "staffType": "clinical",
  "displayName": "Dr Example",
  "approvedRoles": ["surgeon_operator", "consultation_doctor"],
  "membershipStatus": "pending"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `globalProfessionalId` | yes | 3–128 chars `[a-zA-Z0-9._:-]` |
| `email` | yes | Valid email |
| `professionalType` | yes | Non-empty |
| `tenantId` | yes | UUID; must exist in `fi_tenants` |
| `siteId` | no | UUID; must belong to tenant via `fi_clinics` |
| `staffType` | yes | Non-empty |
| `approvedRoles` | yes | Array of canonical role codes |
| `membershipStatus` | no | Default `pending` |
| `deploymentReady` | no | Default `false` |

---

## Payload contract (rollback)

```json
{
  "globalProfessionalId": "iiohr:prof:001",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "reason": "certification revoked in IIOHR"
}
```

---

## Rollback model

Rollback is **scoped and non-destructive**:

1. Sets `active=false`, `revoked_at=now()` on `fi_nexus_role_assignments` where `nexus_created=true` and `active=true` for the tenant.
2. Sets `active=false` on `fi_nexus_staff_profiles` where `nexus_created=true`.
3. Sets `membership_status='revoked'` on `fi_nexus_tenant_memberships` where `nexus_created=true`.
4. Does **not** delete professional rows or manually created (`nexus_created=false`) role assignments.
5. Writes an audit row with before/after state snapshots.

---

## IIOHR adapter integration notes (Phase 9B)

IIOHR `ProductionAdapter` should:

1. **Gate outbound calls** on FI OS readiness (`FI_OS_NEXUS_ENABLED` confirmed in target environment).
2. **Sign every request** using the shared secret and header names above.
3. **Treat provision as idempotent** — safe to retry on network failure; duplicate role assignments are prevented by DB constraint + service logic.
4. **Call `GET /state`** after provision and on reconciliation jobs; inspect `reconciliationWarnings` (e.g. roles assigned while membership still `pending`).
5. **Call `POST /rollback`** when certification is revoked or deployment is reversed in IIOHR; always include a human-readable `reason`.
6. **Do not assume auth login** — Phase 9A does not create Supabase users unless a future phase wires `FI_OS_NEXUS_CREATE_AUTH_USER` to the existing invite flow.

### Example signing (Node.js)

```typescript
import { createHmac } from "node:crypto";

function signNexusBody(secret: string, rawBody: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const material = `${timestamp}.${rawBody}`;
  const signature = createHmac("sha256", secret).update(material, "utf8").digest("hex");
  return { timestamp, signature };
}
```

### Suggested adapter sequence

```
IIOHR certification approved
  → POST /api/nexus/iiohr/provision
  → GET  /api/nexus/iiohr/state?globalProfessionalId=…
  → (FI OS ops activates staff / auth separately)

IIOHR certification revoked
  → POST /api/nexus/iiohr/rollback
  → GET  /api/nexus/iiohr/state?globalProfessionalId=…
```

---

## Source files

| Path | Role |
|------|------|
| `src/lib/nexus/fiOsNexusRoles.ts` | Canonical roles + validation |
| `src/lib/nexus/fiOsNexusEnv.server.ts` | Feature flags |
| `src/lib/nexus/iiohrNexusWebhookAuth.server.ts` | HMAC verification |
| `src/lib/nexus/provisionExternalProfessional.server.ts` | Provision service |
| `src/lib/nexus/rollbackExternalProfessionalProvisioning.server.ts` | Rollback service |
| `src/lib/nexus/readExternalProfessionalState.server.ts` | State + audit writes |
| `src/lib/nexus/nexusIiohrApi.server.ts` | HTTP handlers |
| `app/api/nexus/iiohr/*/route.ts` | Next.js routes |

Tests: `src/lib/nexus/*.test.ts`
