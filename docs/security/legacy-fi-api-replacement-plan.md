# Legacy `/api/fi/*` replacement plan

**Status:** planning only — no implementation in this document.  
**Scope:** HTTP routes under `app/api/fi/**` and the break-glass gate `FI_LEGACY_FI_API_ENABLED` + `FI_LEGACY_FI_API_SECRET` (`assertLegacyFiApiAccess` in `src/lib/fiOs/legacyFiApiAuth.ts`).

## 1. Problem statement

Today, six machine-oriented routes share **one** global Bearer secret. Any caller that possesses `FI_LEGACY_FI_API_SECRET` can hit **any** enabled legacy endpoint and supply **any** `tenant_id` (where applicable). Default-off (`404` when disabled) correctly limits exposure, but the **blast radius** of a single leaked secret remains cross-tenant.

**Goal:** Replace this with **scoped, auditable ingestion**: per-tenant credentials, explicit route-level tenant binding for machine traffic, replay protection, and structured audit logs for every accepted machine request.

**Related code:** `src/lib/fiOs/legacyFiApiAuth.ts`, production env validation in `src/lib/env/fiEnv.server.ts`, existing inventories in `docs/security/api-routes-inventory.md` and `docs/runbooks/fi-os-auth-production-audit.md`.

---

## 2. Route inventory

Legend: **Legacy gate** = `assertLegacyFiApiAccess` (404 if disabled, 401 if wrong Bearer, 503 if enabled but empty secret). **Portal gate** = `checkFiTenantPortalApiAccess` (session + tenant membership / cross-tenant directory role; optional insecure bypass only when non-production per `FI_ALLOW_INSECURE_API`).

| Path | Method | Purpose | Producer / consumer (known) | Auth today | Tenant binding today | Writes clinical / CRM / payment data? | Uses `supabaseAdmin`? | Replacement recommendation |
|------|--------|---------|----------------------------|------------|----------------------|--------------------------------------|-------------------------|------------------------------|
| `/api/fi/events` | POST | FI event envelope ingestion (HLI / HairAudit / clinic-style events) | External integrators; `scripts/verify-fi-event-ingestion.ts` | Legacy gate | From JSON envelope (per `event_type` / handlers in `lib/fi/events/ingest.ts`) | Yes — event handlers mutate FI tables / storage depending on type | Yes — `ingestFiEvent` uses admin client in handlers | **(C)** Signed `POST /api/ingest/[tenantId]/events` (or equivalent); verify tenant in signature scope matches envelope |
| `/api/fi/submit` | POST | Validate uploads, advance case toward pipeline when ready | Integrations / `scripts/replay-test.ts` | Legacy gate | Body `tenant_id` + `case_id` | Yes — case status / workflow | Yes — via `submitCaseIfReady` | **(B+C)** Tenant-scoped URL + HMAC; shared handler with CRM-authenticated path if product needs both |
| `/api/fi/uploads` | POST | Multipart file upload to intakes bucket + `fi_uploads` rows | Integrations; `scripts/verify-fi-event-ingestion.ts`, `scripts/replay-test.ts` | Legacy gate | Form `tenant_id` + `case_id` (case must belong to tenant) | Yes — PHI/clinical files + metadata | Yes | **(C)** Signed uploads URL; consider pre-signed storage + callback or chunked ingest with idempotency keys |
| `/api/fi/cases` | POST | Create `fi_cases` + `fi_intakes` (+ optional partner / referral) | Integrations | Legacy gate | Body `tenant_id` | Yes — PII / clinical intake | Yes | **(B+C)** Tenant path + signed body or CRM server action |
| `/api/fi/partners` | POST | Create `fi_partners` for a tenant | Integrations | Legacy gate | Body `tenant_id` | CRM / partner config (not patient chart) | Yes | **(B)** Prefer admin UI or `assertCrmTenantWriteAllowed`-style API; optional signed bootstrap for automation |
| `/api/fi/run-model` | POST | Run FI scoring pipeline for a case | Integrations / scripts | Legacy gate | Body `tenant_id` + `case_id` | Yes — generates reports / pipeline side effects | Yes — `runPipeline` uses admin | **(B+C)** Tenant-scoped `model-runs` with signed enqueue + job audit |
| `/api/fi/report` | GET | Report metadata + `report_json` for preview | `app/(fi-admin)/fi-admin/[tenantId]/audit/[reportId]/page.tsx` | Portal gate | Query `tenant_id` (+ `case_id` / `report_id`) | Read-only clinical artifact | Yes | **(D+B)** Keep session-first; relocate to `/api/tenants/[tenantId]/...` to drop ambiguous `/api/fi` prefix |
| `/api/fi/audit/approve` | POST | Approve / issue report (`released`) + `fi_audits` row | FI Admin audit UI | Portal gate | Body `tenant_id` | Yes — audit trail + report state | Yes | **(D+B)** Same as report |
| `/api/fi/audit/reject` | POST | Reject report, adjust case status, insert audit row | FI Admin audit UI | Portal gate | Body `tenant_id` | Yes | Yes | **(D+B)** Same |
| `/api/fi/audit/queue` | GET | Audit queue list (draft / changes_required) | No in-repo `fetch` callers located; shares logic with dashboard loader | Portal gate | Query `tenant_id` | Read-only | Yes | **(A)** Confirm via access logs / analytics; if unused, delete. Else **(D+B)** align with dashboard under tenant path |
| `/api/fi/audit/dashboard` | GET | KPIs + embedded queue + pipeline snapshot | `AuditOsDashboard.tsx` | Portal gate | Query `tenant_id` | Read-only | Yes | **(D+B)** Tenant-scoped read API |
| `/api/fi/patient-twin/[patientId]` | GET | PatientTwin V1 read model | Future / internal consumers with session | Portal gate | Query `tenant_id` + path `patientId` | Read-only aggregate | Yes — loader uses service role | **(D+B)** Tenant path; session or short-lived delegated token |
| `/api/fi/copy-check` | POST | Stateless claim-safety check on text | `scripts/copy-check.ts`; optional public if flag on | **Not** legacy secret — `FI_ENABLE_PUBLIC_COPY_CHECK` in production else 404 | N/A | No persistence | No | **(D)** Internal-only authenticated endpoint or feature-flagged dev tool; **out of scope** for `FI_LEGACY_FI_API_*` removal except URL cleanup |

**Note:** `docs/design/19-fi-os-current-state-and-dashboard-roadmap.md` still mentions missing auth on `/api/fi/audit/queue`; the current `app/api/fi/audit/queue/route.ts` implementation **does** call `checkFiTenantPortalApiAccess`. Treat the roadmap note as stale for queue auth.

**Note:** `docs/security/api-routes-inventory.md` lists `GET`+`POST` for `/api/fi/partners`; the repository currently exposes **POST only** in `app/api/fi/partners/route.ts`.

---

## 3. Classification (A–D)

| Route | Class | Rationale |
|-------|-------|-----------|
| `/api/fi/events` | **C** (primary) | Machine ingress; best fit for signed, tenant-scoped ingest with strict audit |
| `/api/fi/uploads` | **C** | Binary + metadata; signature + idempotency + optional direct-to-object-storage |
| `/api/fi/cases` | **B** + **C** | Tenant-scoped creation; machines sign; humans may use session/BFF |
| `/api/fi/submit` | **B** + **C** | Same pattern as cases/uploads |
| `/api/fi/run-model` | **B** + **C** | Heavy side effects; must not rely on global secret |
| `/api/fi/partners` | **B** (preferred) or low-volume **C** | Usually rare admin/bootstrap; prefer CRM-gated admin flow |
| `/api/fi/report`, `/api/fi/audit/*`, `/api/fi/patient-twin/*` | **D** then **B** | Already session-gated — remove from “legacy FI API” mental model by **re-homing URLs** under `/api/tenants/[tenantId]/...`; no shared machine secret |
| `/api/fi/audit/queue` | **A** (pending telemetry) or **D+B** | Likely redundant with dashboard payload; verify before delete |
| `/api/fi/copy-check` | **D** | Independent of `FI_LEGACY_FI_API_*`; handle in same hygiene pass if URLs are normalized |

---

## Migration Readiness Ranking

This section scores every `/api/fi/*` route for **readiness to migrate first** under the constraints in §4–§7. **No replacement endpoints are implemented yet**; scores drive sequencing and pre-code test contracts.

### Scoring scale (1 = low / favorable for “migrate early”, 5 = high / defer or hard)

| # | Dimension | Meaning of **1** | Meaning of **5** |
|---|-----------|------------------|------------------|
| 1 | **Clinical / data sensitivity** | No PHI; config or metadata only | PHI, imaging, or broad longitudinal clinical read models |
| 2 | **Write risk** | Read-only or idempotent-safe | Multi-table writes, workflow side effects, or pipeline mutations |
| 3 | **External producer dependency** | In-repo or internal-only callers | Multiple external products / partners / undocumented callers |
| 4 | **Testability** | Deterministic JSON, small fixtures, fast CI | Multipart, long async pipelines, many handler branches |
| 5 | **Blast-radius reduction** (when legacy gate removed for this route) | Narrow table / rare path | Removes a high-value abuse vector from under the global Bearer |
| 6 | **Effort** | Thin handler, single code path | New storage flow, envelope fan-out, or session + UI rewires |

**Routes not using `FI_LEGACY_FI_API_*`:** For portal (`checkFiTenantPortalApiAccess`) and `copy-check`, columns **3**, **5** are scored for **URL/session migration value** (not shared-secret removal). **5** is **n/a** where the route never contributed to the global Bearer blast radius.

### Per-route scores

| Path | Legacy gate? | 1 Sens | 2 Write | 3 Ext dep | 4 Test | 5 Blast↓ | 6 Effort | Composite note |
|------|--------------|--------|---------|-----------|--------|----------|----------|----------------|
| `/api/fi/partners` | Yes | 2 | 2 | **2** | **4** | 2 | **2** | **Best first candidate:** small JSON body, single-table insert, validates signing + tenant path binding without PHI. |
| `/api/fi/submit` | Yes | 4 | 3 | 3 | 4 | 3 | 3 | Strong second wave: needs existing case + uploads fixtures; lower sensitivity than raw case create or files. |
| `/api/fi/cases` | Yes | **5** | **4** | 3 | 3 | 4 | 3 | Defer until signing + audit path proven; PII on create. |
| `/api/fi/uploads` | Yes | **5** | 3 | 3 | **2** | 4 | **4** | Defer: multipart + storage + size limits; higher implementation and CI cost. |
| `/api/fi/run-model` | Yes | 4 | **5** | 3 | **2** | 4 | **5** | **Last among machine writes:** async pipeline, expensive, hardest rollback; keep behind signed enqueue + strict caps. |
| `/api/fi/events` | Yes | 4 | **4** | **5** | **2** | **5** | **5** | **Highest security payoff** once cut over, but **worst “first” route:** many handlers, external integrators, branching ingest. Schedule immediately **after** one simpler signed route ships. |
| `/api/fi/report` | No | 4 | 1 | 2 | 3 | n/a | 3 | Session route: migrate as **URL re-home + client updates**; no Bearer blast-radius win. |
| `/api/fi/audit/approve` | No | 4 | 3 | 2 | 3 | n/a | 3 | Same as report; test with session / RBAC fixtures. |
| `/api/fi/audit/reject` | No | 4 | 3 | 2 | 3 | n/a | 3 | Same. |
| `/api/fi/audit/queue` | No | 3 | 1 | **1** | **4** | n/a | **1** | **Deletion candidate** (see below); if kept, trivial GET re-home. |
| `/api/fi/audit/dashboard` | No | 3 | 1 | 2 | 3 | n/a | 3 | UI-bound; coordinate with `AuditOsDashboard.tsx`. |
| `/api/fi/patient-twin/[patientId]` | No | **5** | 1 | 2 | **2** | n/a | **4** | Defer: large read surface, heavy fixtures; still session-gated. |
| `/api/fi/copy-check` | No | 1 | 1 | 2 | **5** | n/a | **1** | **Out of legacy-secret scope**; optional hygiene only. |

### Recommendation — safest **first** route to migrate (machine / legacy-gated)

**Primary:** `POST /api/fi/partners` (then new `POST /api/tenants/[tenantId]/fi/partners` or equivalent under §5).

**Rationale:** Lowest clinical sensitivity (no patient row), single bounded write (`fi_partners`), **low external producer dependency** relative to `events`, **high testability** (JSON in/out), **moderate effort** to add HMAC + nonce + audit without multipart or pipeline timing. It exercises the full **§4** contract (path-bound tenant, body `tenant_id` match, `kid`, replay store, audit row) before touching intake or imaging.

**Alternative first route (if product forbids any machine partner API):** Ship the **same signing middleware + audit + nonce store** behind a **temporary internal-only** route (e.g. admin-only CRM mutation) that mirrors partners semantics, then still migrate `partners` first for external parity — do **not** choose `events` as the first production signing surface.

### Routes to leave until later

| Defer | Reason |
|-------|--------|
| `POST /api/fi/events` | Highest **external** and **handler** complexity; keep legacy path until signing stack + observability proven on a smaller route. |
| `POST /api/fi/uploads` | Multipart, storage, virus/size policy, different CI harness. |
| `POST /api/fi/run-model` | **Write risk** and **effort** max; financial/clinical downstream effects from bad enqueue. |
| `POST /api/fi/cases` | **Sensitivity 5**; should follow successful partners + submit patterns. |
| `GET /api/fi/patient-twin/[patientId]` | **Sensitivity 5**, heavy loader; URL move is not urgent for Bearer removal. |
| Portal `report` / `audit/*` | No shared-secret win; batch after machine routes or in parallel UI PRs. |

### Routes that may be **deleted** instead of migrated

| Path | Condition |
|------|-----------|
| `GET /api/fi/audit/queue` | **Delete** if access logs / analytics show **zero** meaningful traffic for a full release cycle **and** product confirms `audit/dashboard` is the only consumer of queue data. Otherwise **re-home** next to dashboard under `/api/tenants/[tenantId]/...` (no separate “queue” URL required if payload stays embedded). |

`POST /api/fi/copy-check` is **not** a deletion target for legacy Bearer work; keep, lock, or move under authenticated tooling per §3.

### Implementation status — partners only (**shipped**)

| Item | Detail |
|------|--------|
| **Route** | `POST /api/ingest/[tenantId]/partners` — [`app/api/ingest/[tenantId]/partners/route.ts`](../../app/api/ingest/[tenantId]/partners/route.ts) |
| **Legacy** | `POST /api/fi/partners` unchanged (still `assertLegacyFiApiAccess` + shared body handler [`createFiPartnerFromBody`](../../src/lib/fi/partners/fiPartnerCreate.server.ts)). |
| **Env** | `FI_MACHINE_INGEST_MASTER_KEY` — long random string; **production** (`NODE_ENV` or `VERCEL_ENV` = `production`) requires **≥32 UTF-8 characters** after trim or requests fail with `503` / audit `master_key_weak` and structured log `machine_ingest_master_key_production_length_invalid` (no secret material). App derives a 32-byte AES key (SHA-256) and encrypts per-tenant HMAC secrets at rest in `fi_machine_ingest_hmac_keys.secret_encrypted`. |
| **DB** | Migration [`20260820120001_fi_machine_ingest_hmac.sql`](../../supabase/migrations/20260820120001_fi_machine_ingest_hmac.sql): `fi_machine_ingest_hmac_keys`, `fi_machine_ingest_nonce`, `fi_machine_ingest_audit` (service_role only). |
| **Signing** | Canonical string: `METHOD\npathname\n{timestampMs}\n{nonce}\n{bodySha256Hex}` (see [`machineIngestCanonical.ts`](../../src/lib/fi/machineIngest/machineIngestCanonical.ts)). `x-fi-timestamp` must be **12–16 decimal digits** only (integer Unix ms; no decimals or scientific notation). Headers: `x-fi-timestamp`, `x-fi-nonce`, `x-fi-key-id`, `x-fi-signature` (hex HMAC-SHA256). Pathname must match the request URL (include `/api/ingest/.../partners`). Body JSON must include `tenant_id` equal to `[tenantId]`. |
| **Logging** | Rejections emit [`logStructured`](../../src/lib/server/structuredLog.ts) `machine_ingest_rejected` (no body); accept/reject rows in `fi_machine_ingest_audit`. Unhandled errors on the partners route log `machine_ingest_partners_route_unhandled` and return a generic **500** body. |
| **Audit `reason_code`** | Verify: `malformed_headers`, `missing_master_key`, `master_key_weak`, `unknown_kid`, `decrypt_failed`, `signature_invalid`, `timestamp_skew`, `tenant_mismatch`, `invalid_json`, `replay_nonce`, `nonce_reserve_failed`. Post-verify business failure: `partner_create_failed`. Accept: `accepted`. |
| **Tests** | [`machineIngestCanonical.test.ts`](../../src/lib/fi/machineIngest/machineIngestCanonical.test.ts), [`machineIngestHmacVerify.test.ts`](../../src/lib/fi/machineIngest/machineIngestHmacVerify.test.ts) (includes legacy gate regression checks). |

**Key onboarding (operators):** insert a row into `fi_machine_ingest_hmac_keys` with `tenant_id`, `kid`, and `secret_encrypted` produced by the app using the same AES helper as in [`machineIngestSecretCrypto.server.ts`](../../src/lib/fi/machineIngest/machineIngestSecretCrypto.server.ts) (`encryptMachineIngestSecret`). Plaintext HMAC secrets must never be stored in the database. Revocation: set `revoked_at`.

**Remaining migration (not started here):** `POST /api/ingest/[tenantId]/events`, uploads, cases, submit, run-model; re-home portal `/api/fi/report` + audit routes; remove `FI_LEGACY_FI_API_*` after all producers switch.

### Exact tests required **before** implementing replacement endpoints

These are **test design requirements** (documentation of expected suites). **Partners subset is implemented** in `src/lib/fi/machineIngest/*.test.ts` (canonical + verify + legacy gate).

#### A. Signing and gate middleware (applies to first shipped signed route, e.g. partners)

1. **Happy path:** Valid `kid`, timestamp within skew, fresh nonce, body hash matches canonical string, path `tenantId` matches body `tenant_id` → **200** and handler runs once.
2. **Bad signature:** Correct shape, wrong MAC → **401**; audit row or structured log with outcome `signature_invalid` (no body PHI).
3. **Wrong tenant:** Signature valid for tenant A, request to path tenant B → **400** or **401** per §4.3; audit `tenant_mismatch`.
4. **Stale timestamp:** Outside allowed skew → **401**; audit `timestamp_skew`.
5. **Replayed nonce:** Same `(tenant_id, kid, nonce)` within TTL → **409**; audit `replay_nonce`.
6. **Unknown / retired `kid`:** No matching active key (includes revoked / `revoked_at` set) → **401**; audit `unknown_kid`.
7. **Missing headers:** Any required signing header absent → **400**; audit `malformed_headers`.

#### B. Legacy compatibility and smoke (existing + extended)

8. **`scripts/fi-production-smoke-test.ts` expectations unchanged** until Phase 6: unauthenticated `POST /api/fi/events` still **404** / **401** as today when legacy off or wrong Bearer.
9. **After** new signed route exists **alongside** legacy: contract test that **legacy** `POST /api/fi/partners` still returns **404** when `FI_LEGACY_FI_API_ENABLED` is unset (no regression).
10. **Golden JSON:** Request body for partners matches current validation (`tenant_id`, `name`, `reference_code`, optional fields) — reject unknown fields policy documented in same PR as tests.

#### C. Data-plane correctness (partners-first)

11. **Idempotency / conflict:** Duplicate `reference_code` for same tenant → **409** (current behavior); assert new route preserves same DB semantics.
12. **Tenant existence:** Unknown `tenant_id` → **404** from business logic (unchanged).
13. **Authorization boundary:** Valid signature for tenant T does **not** allow insert with `tenant_id` ≠ T in body (redundant with A.3 but assert at handler).

#### D. Routes deferred to later phases (prepare test backlog, do not block partners-first)

14. **Events:** Per-`event_type` golden envelopes for each supported type in `lib/fi/events/schema.ts` + assert ingest result shape; fuzz unsupported `event_type` → controlled **400**.
15. **Uploads:** Multipart boundary tests, oversize rejection, MIME allowlist, storage failure partial rollback behavior.
16. **Run-model:** Timeout / job idempotency, dry-run parity if exposed.
17. **Portal session routes:** E2E or integration with real session cookie (or test double for `checkFiTenantPortalApiAccess`) for one tenant read and one write (approve).

#### E. Operational / audit

18. **Audit log query:** Filter by `tenant_id` + route + time window returns accepted and rejected rows with no secret material.
19. **Key rotation:** Two active keys for same tenant; requests with either `kid` succeed; revoked key fails (manual or scripted rotation test).

---

## 4. Replacement auth model (target)

### 4.1 Machine producers (integrations, workers)

- **Per-tenant HMAC** (or asymmetric per-tenant keys): signing key **never** shared across tenants. Prefer **key id** (`kid`) in header for rotation.
- **Canonical request string** includes: HTTP method, path **including tenant id**, hash of body (for JSON), content-type, and signed headers as needed.
- **Timestamp + nonce**:
  - Require `X-FI-Timestamp` (Unix ms) skew window (e.g. ±5 minutes).
  - Require `X-FI-Nonce` stored in short-TTL dedupe store (Redis / Supabase table with TTL) keyed by `(tenant_id, nonce)` or global nonce uniqueness.
- **Replay protection:** reject duplicate `(kid, nonce)` or replayed body hash within TTL.
- **Key rotation:** support **two active keys** per tenant during rotation; `kid` selects verification material.
- **Audit logging (mandatory on accept):** append-only row or structured log with: `tenant_id`, `kid`, route, request id, body hash / size, outcome, integration id (if distinct from tenant), IP / edge request id (where available), processing latency. **Do not log raw PHI** in audit payloads.

### 4.2 User-driven routes (browser, FI Admin)

- **Short-lived session** (current Supabase session pattern) remains primary.
- Optional **short-lived JWT** for specific actions (e.g. delegated report download) minted server-side with explicit `tenant_id` + minimal scopes + expiry (minutes).

### 4.3 Route-level tenant binding

- Machine routes **must** encode `tenantId` in the URL path (see §5). Signature validation **must** bind to that path segment so a valid signature for tenant A cannot be replayed against tenant B’s path.
- Request body `tenant_id` must **match** path tenant after normalization; mismatch → **400** + audit **reject**.

### 4.4 Operational controls (additive)

- Per-tenant rate limits, IP allowlists, and optional **mTLS** for high-trust integrators remain compatible with HMAC-first design.

---

## 5. Proposed route architecture (examples)

These names are **targets** for product/eng alignment; adjust to match existing `/api/crm/**` or `/api/tenants/**` conventions elsewhere in the monolith.

| Concern | Example path |
|---------|----------------|
| Signed event ingest | `POST /api/ingest/[tenantId]/events` |
| Signed multipart / presign flow | `POST /api/ingest/[tenantId]/uploads` (or `.../upload-sessions` + callback) |
| Case create (machine or server) | `POST /api/tenants/[tenantId]/fi/cases` |
| Submit when ready | `POST /api/tenants/[tenantId]/fi/cases/[caseId]/submit` |
| Partner admin | **Live:** `POST /api/ingest/[tenantId]/partners` (signed). **Planned:** `POST /api/tenants/[tenantId]/fi/partners` (CRM-gated) |
| Model run enqueue | `POST /api/tenants/[tenantId]/fi/model-runs` |
| Report read (session) | `GET /api/tenants/[tenantId]/fi/reports/[reportId]` |
| Audit queue / dashboard (session) | `GET /api/tenants/[tenantId]/fi/audit/dashboard` |
| Audit actions (session) | `POST /api/tenants/[tenantId]/fi/audit/reports/[reportId]/approve` (etc.) |
| Patient twin (session) | `GET /api/tenants/[tenantId]/fi/patients/[patientId]/twin` |

**Principle:** `/api/fi/*` disappears from public contracts; **ingest** and **tenant** namespaces make scope obvious to integrators and security reviewers.

---

## 6. Migration sequence

| Phase | Activities |
|-------|------------|
| **1 — Inventory and docs** | This document + update `docs/security/api-routes-inventory.md` after implementation; confirm external callers via logs, partner runbooks, and reverse-proxy metrics. |
| **2 — New endpoints beside legacy** | Implement §4–§5 routes; feature-flag rollout per tenant; document signing algorithm and example clients. |
| **3 — Dual-write / shadow-validate** | Optional: for events, mirror-verify signature on new path while legacy still receives traffic; compare handler outcomes in shadow mode only where safe. |
| **4 — Migrate producers** | HLI / HairAudit / internal workers switch to new URLs + per-tenant keys; rotate away from any temporary global secrets. |
| **5 — Disable legacy permanently** | Remove `FI_LEGACY_FI_API_ENABLED` from all production envs; ensure `FI_LEGACY_FI_API_SECRET` unused; smoke tests expect **404** on old paths (see `scripts/fi-production-smoke-test.ts`). |
| **6 — Delete legacy** | Remove `app/api/fi/events|submit|uploads|cases|partners|run-model` handlers, `assertLegacyFiApiAccess` if nothing else uses it, and env validation branches for `FI_LEGACY_FI_API_*` when no longer required. Re-home portal routes from §2 under `/api/tenants/...` and update UI `fetch` paths. |

---

## 7. Acceptance criteria

1. **No global shared secret for cross-tenant writes:** No production route accepts a **single** Bearer token that authorizes writes across arbitrary tenants. Per-tenant keys or session-based CRM gates only.
2. **Every machine request is tenant-scoped:** URL includes `tenantId`; signature or auth context binds to that tenant; body tenant fields must match.
3. **Every accepted machine request is auditable:** Structured audit record (see §4.1) for **200** and for **rejected** signature attempts (without storing secrets or raw PHI).
4. **Replay protection exists:** Clock skew + nonce dedupe (or equivalent) enforced on all signed machine routes.
5. **Legacy paths in production:** `POST /api/fi/events` (and siblings that used the legacy gate) return **404** when legacy is disabled — preserved until Phase 6; after removal, **404** (or **410 Gone** with no sensitive body) permanently in production.
6. **Integration tests:** Automated tests cover signed request **success**, **bad signature**, **wrong tenant**, **stale timestamp**, **replayed nonce** (`replay_nonce`), and **unknown kid** — at minimum for the **first shipped signed machine route** (see **Migration Readiness Ranking**; `partners` is the preferred first surface before `events`).

---

## 8. Out of scope for this plan (explicit)

- Changing `src/lib/env/fiEnv.server.ts` or route handlers **now** (per stakeholder request).
- Stripe / payment webhooks (`/api/fi-payments/**`) — already separate signing model; see `docs/security/payment-webhook-idempotency.md`.
- Removing or renaming environment variables before Phase 6 engineering work.

---

## 9. References (in-repo)

- `src/lib/fiOs/legacyFiApiAuth.ts` — legacy gate implementation  
- `docs/runbooks/fi-os-auth-production-audit.md` — risk table  
- `docs/security/api-routes-inventory.md` — high-level route matrix  
- `docs/security/infrastructure-hardening-audit.md` — break-glass guidance  
- `lib/fi/events/ingest.ts` — event dispatch and admin usage  

---

*Document version: 2026-06-16. §3b partners signed ingest added 2026-06-16.*
