# FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — HairAudit Projection Gateway and Provider Foundation

**Date:** 2026-07-30  
**Verdict:** GREEN (gateway + provider foundation)  
**Provider state:** `STUB_ONLY_NON_PRODUCTION` (default) / `PROVIDER_DISABLED` when feature flags off or stub blocked in production  
**Not claimed:** Real generative image transformation (`REAL_PROVIDER_CONNECTED` is **not** achieved in 1A)

---

## 1. Architecture

Shared FiOS projection domain under `src/lib/imaging-os/preSurgeryProjection/` supports two source channels from day one:

| Channel | 1A status |
|---------|-----------|
| `hairaudit_service` | Fully exposed via HTTP gateway |
| `fios_clinic` | Domain contracts + `clinicCommand.server.ts` interface; UI/patient-sharing deferred to **1B** |

```text
HairAudit imagingOsProvider
  → POST /api/v1/pre-surgery/projections  (Bearer + HMAC)
  → auth / replay / validate / idempotency
  → shared job lifecycle + provider registry
  → output validation + private storage
  → sync success body (HairAudit parser)
  → optional signed callback (requires projectionId — see contract note)

FiOS clinic (1B)
  → clinicCommand / domain services (same jobs, storage, provider, audit rules)
```

Every job records: `source_channel`, `tenant_id`, `clinic_id`, internal patient/case/procedure refs when available, and external HairAudit refs when applicable.

HairAudit → FiOS tenant/clinic mapping is **server-controlled** (`HAIRAUDIT_PROJECTION_FIOS_TENANT_ID` / `HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID`). Request body tenant IDs are never trusted.

---

## 2. Exact API routes

Configure HairAudit:

```env
HA_IMAGINGOS_PROJECTION_URL=https://<fi-os-host>/api
HA_IMAGINGOS_PROJECTION_TOKEN=<same as HAIRAUDIT_PROJECTION_SERVICE_TOKEN>
HA_IMAGINGOS_PROJECTION_SIGNING_SECRET=<same as HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET>
```

| Method | Public path | Next.js file |
|--------|-------------|--------------|
| `POST` | `/api/v1/pre-surgery/projections` | `app/api/v1/pre-surgery/projections/route.ts` |
| `GET` | `/api/health` | `app/api/health/route.ts` |

Signing path verified as **`/v1/pre-surgery/projections`** (HairAudit constant — not the `/api` prefix).

Classifier routes (`/api/internal/imaging/classify`, `/api/internal/hairaudit/image-classify`) are unchanged and use separate tokens.

---

## 3. Request / response schemas

### Request (`ha-imagingos-pre-surgery-projection-request-v1`)

Matches HairAudit `imagingOsProvider.buildRequestBody` exactly, including nullable `idempotencyKey` / `inputChecksum` / `canonical`, plus forward-compatible optional `projectionId` / `externalProjectionId`.

### Success response (HairAudit `parseSuccessBody`)

```ts
{
  outputStorageRef: string
  outputChecksum: string
  providerRequestId?: string
  providerResponseId?: string
  modelVersion?: string
  limitations?: string[]
  planningAssumptions?: string[]
}
```

Aliases `output_storage_ref` / `output_checksum` are accepted by HairAudit but FiOS emits camelCase.

### Callback payload (FiOS → HairAudit)

```ts
{
  caseId: string
  projectionId: string      // required by HairAudit receiver
  providerResponseId: string
  status: "completed" | "failed"
  outputStorageRef?: string
  outputChecksum?: string
  errorCode?: string
  message?: string
}
```

URL: `{HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL}/{caseId}/pre-surgery-intelligence/projection/callback`  
Host comes **only** from FiOS config — never from the request body.

### Contract note — `projectionId`

HairAudit’s callback receiver **requires** `projectionId` (row id in `hairaudit_pre_surgery_projections`), but the current outbound ImagingOS request **does not send it**.  
1A accepts optional body fields / `X-HairAudit-Projection-Id`. Without it, **sync responses work**; async callbacks are skipped with a structured audit reason (`missing_projection_id_contract`). Recommend HairAudit add `projectionId` in a follow-up before relying on async completion.

---

## 4. Signing algorithms

### Inbound request (HairAudit → FiOS)

Headers: `Authorization`, `Idempotency-Key`, `X-HairAudit-Timestamp`, `X-HairAudit-Case-Id`, `X-HairAudit-Signature`

```text
HMAC-SHA256(
  METHOD + "\n" + path + "\n" + timestamp + "\n" + idempotencyKey + "\n" + sha256_hex(rawBody)
)
```

- Path: `/v1/pre-surgery/projections`
- Raw-body verification + constant-time hex compare
- Default skew: 300s (`FI_PRE_SURGERY_PROJECTION_TIMESTAMP_SKEW_SECONDS`)
- Persistent replay table (not memory-only)

### Outbound callback (FiOS → HairAudit)

```text
HMAC-SHA256(timestamp + "." + rawBody)  →  x-hairaudit-signature
```

---

## 5. Environment variables

| Variable | Purpose |
|----------|---------|
| `HAIRAUDIT_PROJECTION_SERVICE_TOKEN` | Bearer for gateway + health |
| `HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET` | Inbound HMAC |
| `HAIRAUDIT_PROJECTION_CALLBACK_SIGNING_SECRET` | Outbound callback HMAC |
| `HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL` | Trusted callback base (`…/api/cases`) |
| `HAIRAUDIT_PROJECTION_FIOS_TENANT_ID` | Mapped FiOS tenant |
| `HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID` | Mapped FiOS clinic |
| `FI_PRE_SURGERY_PROJECTION_PROVIDER` | `stub` \| `disabled` |
| `FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION` | default `false` |
| `FI_PRE_SURGERY_PROJECTION_ENABLED` | Master switch |
| `FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED` | HairAudit channel |
| `FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED` | Clinic channel (1B) |
| `FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED` | Patient sharing (1B) |
| `FI_PRE_SURGERY_PROJECTION_REQUIRE_HMAC` | Force HMAC (on by default in production) |
| `FI_PRE_SURGERY_PROJECTION_STORAGE_BUCKET` | default `pre-surgery-projections` |
| `FI_PRE_SURGERY_PROJECTION_SYNC_BUDGET_MS` | Sync generation budget |

**Do not reuse** `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` / `FI_INTERNAL_IMAGING_*`.

---

## 6. Migration

File: `supabase/migrations/202611036001_imaging_os_pre_surgery_projection_1a.sql`

- `imaging_os_pre_surgery_projection_jobs` — unique `(service_source, case_id, idempotency_key)`
- `imaging_os_pre_surgery_projection_replays`
- `imaging_os_pre_surgery_projection_integrations`
- Private bucket `pre-surgery-projections`
- RLS enabled; **service_role only** (no anon/authenticated grants)

**Status:** authored locally — apply with normal Supabase migration workflow before enabling in production.

---

## 7. Provider status

| State | When |
|-------|------|
| `STUB_ONLY_NON_PRODUCTION` | Enabled + stub provider outside production (or stub explicitly allowed) |
| `PROVIDER_DISABLED` | Feature off, provider=`disabled`, or stub blocked in production |
| `REAL_PROVIDER_CONNECTED` | **Not available in 1A** |

No speculative external generator is wired. Enabling the route without a permitted provider returns **503**.

Stub outputs always include limitations stating they are **not** a clinical generative model.

---

## 8. Security boundary

- Anonymous → 401  
- Browser cookie session without service bearer → 403  
- Only dedicated projection service token  
- Stale / invalid HMAC → 401  
- Replay → 409  
- Case header ≠ body → 403  
- Private storage; opaque `bucket:path` refs; short-lived signed URLs only if explicitly requested  
- Cross-case access denied  
- DB service-role only  
- Callback host from trusted config only  

---

## 9. HairAudit compatibility evidence

| HairAudit artifact | FiOS alignment |
|--------------------|----------------|
| `imagingOsProvider.ts` request body | `schema.ts` + fixture |
| `signImagingOsRequest` | `hmac.ts` identical material |
| `parseSuccessBody` fields | gateway success response |
| Callback HMAC `timestamp.rawBody` | `signHairAuditProjectionCallback` |
| Callback required `projectionId` | Documented gap + optional accept |
| Health `GET …/health` + Bearer | `/api/health` |

---

## 10. Tests

```bash
npm run test:pre-surgery-projection-1a
npm run check:migrations
npm run typecheck
npm run build
```

Coverage includes: schema, bearer, HMAC, skew, replay, raw-body integrity, case mismatch, idempotency hit/conflict, validation, stub blocked in production, disabled 503, sync success, callback signing/retries, output validation, private storage path, cross-case isolation, RLS/migration contract, health, classifier route isolation.

---

## 11. Known limitations

- No real generative provider connected  
- Clinic UI / patient sharing = 1B  
- Async callback needs HairAudit to send `projectionId`  
- Tenant mapping is env-primary in 1A (DB integrations table reserved)  
- Gateway disabled by default (`FI_PRE_SURGERY_PROJECTION_ENABLED=false`)

---

## 12. Enablement steps

1. Apply migration `202611036001_imaging_os_pre_surgery_projection_1a`  
2. Set projection tokens + signing secrets (dedicated; ≥16 chars)  
3. Set `HAIRAUDIT_PROJECTION_FIOS_TENANT_ID` / `CLINIC_ID`  
4. Set callback base URL to HairAudit cases API  
5. Non-prod: `FI_PRE_SURGERY_PROJECTION_ENABLED=true`, `…_HAIRAUDIT_ENABLED=true`, `PROVIDER=stub`  
6. Point HairAudit `HA_IMAGINGOS_PROJECTION_URL` at `https://<host>/api`  
7. Confirm `GET /api/health` with bearer → `degraded`/`healthy` (not credentials leaked)  
8. Production: keep stub blocked until a real provider is connected and evidenced  

---

## 13. Rollback

1. Set `FI_PRE_SURGERY_PROJECTION_ENABLED=false` (and/or `…_HAIRAUDIT_ENABLED=false`)  
2. On HairAudit: `HA_PRE_SURGERY_PROJECTION_PROVIDER=stub|disabled`  
3. Optional: set `FI_PRE_SURGERY_PROJECTION_PROVIDER=disabled`  
4. Do not delete migration once applied; leave tables idle  
5. Classifier/capture workflows remain untouched  

---

## 14. 1B interface

Import from:

- `clinicCommand.server.ts` — approve/reject/stale/regenerate hooks  
- `domain.server.ts` — lifecycle + visibility rules  
- `gateway.server.ts` / `jobs.server.ts` / `storage.server.ts` / `providerRegistry.server.ts` — shared stack  

Do not duplicate provider, job, storage, approval, or audit logic in 1B.
