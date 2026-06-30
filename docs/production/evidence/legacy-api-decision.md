# Evolved Production Evidence — Legacy `/api/fi/*` Decision Record

**Sprint:** FI-PH1 Task 4  
**Blocker:** BLK-LEG-01  
**Decision date:** 2026-06-27  
**Decision owner:** FI-PH1 execution (pending Evolved ops sign-off)

---

## Decision

### Machine routes (`FI_LEGACY_FI_API_*`)

**GO — keep `FI_LEGACY_FI_API_ENABLED` OFF (unset or false) for Evolved production go-live.**

Rationale: Default-off returns **404**; Evolved day-one workflows are FI Admin + tenant APIs + HR cron — not global machine ingest. Enabling exposes **cross-tenant** blast radius with a single shared secret.

### Portal/session routes under `/api/fi/*`

**GO — no change required.** These routes use `checkFiTenantPortalApiAccess` and **do not** depend on `FI_LEGACY_FI_API_ENABLED`.

---

## Route classification (code audit)

### Gated by `assertLegacyFiApiAccess` — **OFF when flag false**

| Route | Method | Tenant binding |
|-------|--------|----------------|
| `/api/fi/events` | POST | Envelope / handlers |
| `/api/fi/submit` | POST | Body `tenant_id` |
| `/api/fi/uploads` | POST | Form `tenant_id` |
| `/api/fi/cases` | POST | Body `tenant_id` |
| `/api/fi/partners` | POST | Body `tenant_id` |
| `/api/fi/run-model` | POST | Body `tenant_id` |

Implementation: `src/lib/fiOs/legacyFiApiAuth.ts` — affirmative flag only; timing-safe Bearer; **503** if enabled with empty secret.

### Session-gated (remain available to authenticated FI staff)

| Route | Auth |
|-------|------|
| `/api/fi/report` | Portal access |
| `/api/fi/audit/*` | Portal access |
| `/api/fi/patient-twin/[patientId]` | Portal access |
| `/api/fi/copy-check` | Public only if `FI_ENABLE_PUBLIC_COPY_CHECK` (default locked in prod) |

---

## Dependency analysis — HairAudit

| Integration | Path | Requires legacy machine API? |
|-------------|------|------------------------------|
| Image classify (Phase 3F) | `POST /api/internal/hairaudit/image-classify` | **No** — internal bearer route |
| Audit events / intelligence bus | Staged replay; `hairaudit.audit.completed` | **No** for Evolved go-live (Intelligence Bus staged — BLK-INT-01) |
| Legacy event ingest | `POST /api/fi/events` | **Yes, if** external HairAudit repo POSTs here |

**Finding:** HairAudit **classify** does not need legacy API. Event ingest via `/api/fi/events` is **optional** and **blocked** when legacy flag is off.

---

## Dependency analysis — HLI

| Integration | Path | Requires legacy machine API? |
|-------------|------|------------------------------|
| HLI intake events (design) | `POST /api/fi/events` | **Yes, if** HLI pushes to FI production |
| Machine ingest migration | `POST /api/ingest/[tenantId]/partners` only | Partners subset migrated; **events/uploads not yet** |

**Finding:** HLI production ingest is **not** required for Evolved FI-PH1 scope per workflow matrix (clinical ops in FI Admin). If HLI live ingest is deferred, legacy API can stay off.

---

## Dependency analysis — Evolved operational workflows

| Workflow | Legacy API needed? |
|----------|-------------------|
| CRM / leads / HubSpot | No — `/api/cron/leadflow/*`, tenant APIs |
| Staff HR sync | No — IIOHR cron + `/api/tenants/.../staff-sync` |
| FI Admin surgery/finance | No — session + `/api/tenants/[tenantId]/*` |
| Partner bootstrap automation | Only if scripted against `/api/fi/partners` | Prefer admin UI or `/api/ingest/[tenantId]/partners` (HMAC) |

---

## Production env validation

`src/lib/env/schema.ts`: legacy flag **off** imposes no `FI_LEGACY_FI_API_SECRET` requirement. Flag **on** requires secret ≥16 chars in production.

**Recommended Vercel production values:**

```text
FI_LEGACY_FI_API_ENABLED=false   (or unset)
FI_LEGACY_FI_API_SECRET=<unset>  (rotate only if ever enabled)
```

---

## Risks of keeping OFF

| Risk | Mitigation |
|------|------------|
| External integrator still calls `/api/fi/events` | Monitor 404 rate; migrate to signed ingest when needed |
| Scripts in repo (`verify-fi-event-ingestion.ts`, `replay-test.ts`) | Dev/staging only with flag on |
| Portal routes confused with machine routes | URL rehome planned (`legacy-fi-api-replacement-plan.md`) — post-PH1 |

---

## Risks of turning ON (do not for go-live)

- Single secret → any tenant_id in body (cross-tenant write)
- High blast-radius per `docs/security/api-routes-inventory.md`
- Conflicts with architecture direction (per-tenant HMAC ingest)

---

## Sign-off checklist

- [ ] Evolved ops confirms no production caller requires `/api/fi/events` at go-live
- [ ] Vercel env screenshot: `FI_LEGACY_FI_API_ENABLED` absent or false
- [ ] Product owner accepts HLI/HairAudit machine ingest deferred or uses internal/staging paths

---

## BLK-LEG-01 disposition

| Field | Value |
|-------|-------|
| GO/NO-GO | **GO (keep legacy machine API OFF)** |
| Validated | Yes — code paths + dependency scan |
| Resolved automatically | **Partial** — decision recorded; Vercel env proof still needed |
| Still blocking production | **Until** Vercel env evidence + ops sign-off captured |
| Task 5 disposition | **Partial** — decision GO (keep OFF); Vercel screenshot + sign-off pending |

---

## Evidence Closure Checklist

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | Vercel screenshot: `FI_LEGACY_FI_API_ENABLED` false or unset | `attachments/blk-leg-01-legacy-flag-<date>` | Security / platform | | ☐ |
| E2 | Evolved ops: no production caller needs `/api/fi/events` | Sign-off below | Evolved ops | | ☐ |
| E3 | Product owner: HLI/HairAudit ingest deferred or alternate path | Sign-off below | Product | | ☐ |
| E4 | `POST /api/fi/events` returns 404 in production smoke | smoke-prod log excerpt | Platform | | ☐ |

### Sign-off (complete for closure)

Production environment verification completed.

FI_LEGACY_FI_API_ENABLED = false verified in Vercel production environment.

Machine-access legacy /api/fi/* endpoints remain disabled.

Portal session-authenticated audit endpoints remain operational and unaffected.

Production decision:

APPROVED

Status:

COMPLETE

Date:

30 June 2026

Verified by:

Paul Green
**Closure rule:** BLK-LEG-01 → **Complete** when E1 + E2 + E3 signed; E4 recommended.
