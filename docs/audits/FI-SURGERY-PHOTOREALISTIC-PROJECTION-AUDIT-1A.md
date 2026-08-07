# FI-SURGERY-PHOTOREALISTIC-PROJECTION-AUDIT-1A

**Date:** 2026-08-07  
**Scope:** FiOS surgery projection create → store → label → approve → display → share, plus FiOS↔HairAudit boundary  
**Production data:** read-only inspection only (no writes)

---

## Executive verdict

| Surface | FiOS status | Evidence |
|---|---|---|
| Graft Allocation Map | **RED** | Text/`jsonb` zones on `fi_case_surgery_plans` only — no visual coloured allocation map product |
| Proposed Hairline Design | **RED** | Consultation SVG/forms only — no photo-bound, versioned, approvable hairline design |
| Photorealistic Projected Outcome | **RED** | ImagingOS gateway exists; provider registry is `stub` \| `disabled` only; **0 jobs**, **0 storage objects** |
| Cross-product synchronisation | **RED** | Shared gateway designed but unused; HairAudit now generates OpenAI outcomes **directly** in its own DB |

Do **not** treat the FiOS page names “Surgery”, “Imaging”, or “visual summary”, or the existence of `POST /api/v1/pre-surgery/projections`, as a photorealistic projected outcome.

A photorealistic projected outcome is **GREEN** for FiOS only when a clinician can inspect a real natural-looking hair edit tied to an approved FiOS plan + hairline version. That condition is **not met**.

---

## 1. Current FiOS architecture

### Canonical path (as designed in 1A — mostly unrealised)

```text
FiOS surgical plan (fi_case_surgery_plans — text zones)
  ↛ hairline design (missing in FiOS)
  → [HairAudit channel only] POST /api/v1/pre-surgery/projections
  → auth / HMAC / idempotency / job
  → provider registry (stub | disabled)
  → private bucket pre-surgery-projections
  → clinician_review_state = awaiting_review
  ↛ clinic UI approve / patient share (deferred 1B)
  → optional signed callback to HairAudit (needs projectionId)
```

**Actual operating path today:** HairAudit owns graft plans, annotations, hairline overlays, and OpenAI illustrative outcomes end-to-end. FiOS ImagingOS gateway is schema-ready but unused (zero live jobs).

### Package / ownership

| System | Role today |
|---|---|
| FiOS (`g:\follicleintelligence`) | ImagingOS **gateway + stub provider + job/storage domain** for HairAudit channel; clinic channel stubbed |
| HairAudit (`G:\hairaudit-v2`) | System of record for pre-surgery graft plans, annotations, three artifact types, OpenAI gpt-image provider, approval, patient sharing |
| `@follicle/intelligence-core` | Event/photo contracts — **not** projection runtime |
| Shared projection npm package | **Does not exist** |

---

## 2. Inventory — all FiOS projection-related surfaces

### Routes / APIs

| Path | Role | Artifact class |
|---|---|---|
| `app/api/v1/pre-surgery/projections/route.ts` | HairAudit projection gateway | photoreal (intended) — stub only |
| `app/api/health/route.ts` | Projection health (Bearer) | infra |
| `app/(fi-admin)/…/cases/[caseId]/page.tsx` + `CaseSurgeryPlanningCard` | Surgery planning foundation | plan (text) |
| `app/(fi-admin)/…/surgery*`, `surgery-os*` | SurgeryOS procedure-day / graft tally | adjacent ≠ allocation map |
| `app/(fi-admin)/…/imaging*`, patient imaging | Imaging review / AI jobs | adjacent ≠ projection |
| `app/patient/…/visual-summary*` | Post-op style visual summary | **not** pre-surgery projection |
| ConsultationOS form templates | Hairline/graft form fields + SVG body map | schematic hairline / plan |

No clinic Next.js page requests, approves, or shares pre-surgery illustrative projections.

### Core module

`src/lib/imaging-os/preSurgeryProjection/`

| File | Role |
|---|---|
| `gateway.server.ts` | Auth → validate → job → generate → store → callback |
| `schema.ts` / `types.ts` | HA request + canonical snapshot |
| `provider.ts` / `providerRegistry.server.ts` / `stubProvider.server.ts` | Provider contract; **only stub** |
| `jobs.server.ts` / `storage.server.ts` | Job store + private bucket |
| `domain.server.ts` / `clinicCommand.server.ts` | Approve/reject/share rules; clinic request **rejects until 1B** |
| `auth.ts` / `hmac.ts` / `replayProtection` / `idempotency` / `callback` / `tenantMapping` | Security boundary |

Prior gateway audit: `docs/audits/FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A.md` (GREEN for gateway foundation; explicitly **not** `REAL_PROVIDER_CONNECTED`).

### Database / storage (Follicle Intelligence project `iqqvzgxoimxchhcnbzxl`)

| Object | Status |
|---|---|
| `imaging_os_pre_surgery_projection_jobs` | Migrated — **0 rows** |
| `imaging_os_pre_surgery_projection_replays` | Migrated — idle |
| `imaging_os_pre_surgery_projection_integrations` | Migrated — idle |
| Bucket `pre-surgery-projections` | Exists, **private**, **0 objects** |
| `fi_case_surgery_plans` | Exists — **1 smoke-test row** (no zones, no graft range) |

IIHOR prod (`yppinmjbusxechcguxdp`): projection + surgery-plan tables **not present**.

### Feature flags / env (defaults from `.env.example`)

All generation/sharing flags default **off**:

- `FI_PRE_SURGERY_PROJECTION_ENABLED=false`
- `FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED=false`
- `FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED=false`
- `FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED=false`
- `FI_PRE_SURGERY_PROJECTION_PROVIDER=stub`
- `FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION=false`
- Plus HMAC / tokens / tenant mapping / storage / sync budget vars

### Entitlements

Module entitlements `imaging_os` / `surgery_os` gate Imaging/Surgery OS access only. **No** capability keys for:

- generate projection  
- clinically approve projection  
- enable patient sharing of projection  
- per-generation cost recording  

### Queues

No dedicated projection worker/queue. Gateway runs generation **synchronously** inside the request (`syncBudgetMs`, default 25s). Status bit `queued` is transitional only.

### Terminology absent in FiOS

`illustrative_projected_outcome`, `graft_allocation_map`, `proposed_hairline_design` — **not defined** in FiOS schema or types. Those enums live in HairAudit `artifactTypes.ts`.

---

## 3. Representative records

### FiOS Follicle Intelligence — projection jobs

**None.** Table present, empty. No job IDs, storage refs, checksums, approvals, or HairAudit associations exist on FiOS.

### FiOS — surgery plan (only live-adjacent row)

| Field | Value |
|---|---|
| id | `0afc0148-df82-48ff-8f61-9eb317ba9731` |
| tenant | `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| case | `efa25110-9dbc-4599-8fbd-3670e8921efd` |
| status | `in_progress` |
| procedure | `FUE` |
| zones | `[]` |
| graft min/max | null |
| summary | `SMOKETEST surgical plan summary` |
| Artifact reality | **Text placeholder** — not graft map / hairline / photoreal |

### HairAudit reference case (cross-product evidence — HA DB `vbzjkqhvzfunahmlxevb`)

Case `83de37d6-5548-4efa-afe9-9ceeb34a226d`, approved graft plan v4 `9301046e-80fa-4cba-9828-01fe3563fdb6`.

| Record id | artifact_type | provider | status | patient_sharing | Storage reality |
|---|---|---|---|---|---|
| `cd51d8da-…` | `graft_allocation_map` | `local-illustrative-v1` | approved | false | JPEG ~667 KB in `case-files` (coloured overlay — **not** photoreal) |
| `3af857db-…` | `proposed_hairline_design` | `local-illustrative-v1` | approved | false | JPEG ~701 KB |
| `2791b827-…` | `illustrative_projected_outcome` | `openai-gpt-image` | clinician_review | false | JPEG **743 044 B**, 1799×2400, MIME `image/jpeg`, checksum `7cef5d61…` |
| `888131c1-…` / `5d6b65be-…` | illustrative | openai-gpt-image | rejected | false | Real JPEGs |
| `43d9ccdc-…` | illustrative | openai-gpt-image | validation_failed | false | Real JPEG (~266 KB) |
| `4c643dbb-…` / `5c8aebba-…` | graft_allocation_map (reclassified) | `stub-v1` | approved | **true** (legacy) | **`.stub` paths** — placeholders |

Latest OpenAI outcome (`2791b827-…`) references:

- approved plan v4 + checksum  
- hairline gate from approved hairline artifact `3af857db-…` v1  
- frontal source `e5df3ddb-…`  
- treatment mask checksum  
- outcomeValidation (mime/dims/face/out-of-mask deltas)  
- disclaimer text matching required wording  
- **not** auto-shared; awaiting clinician review  

**Classification rule applied:** do not trust label alone — overlay/local-illustrative = map or hairline; stub = placeholder; openai jpeg with validation = candidate illustrative outcome.

---

## 4. Provider capability audit (FiOS)

| Question | Answer |
|---|---|
| ImagingOS operational for generation? | **Gateway only** — no real generator wired |
| Local overlay renderer in FiOS? | **No** |
| OpenAI image editing in FiOS? | **No** (OpenAI in FiOS is classifiers / graft-tray only) |
| Operational provider? | **`stub` solid-colour PNG via sharp**, blocked in production by default |
| Adapter presence = operational? | **No** — registry explicitly refuses non-stub |

```ts
// providerRegistry.server.ts — only stub; else 503
export type ProjectionProviderName = "stub" | "disabled";
```

Stub limitations explicitly forbid presenting output as clinical projection.

Storage contract on success: MIME jpeg/png/webp, size/dim bounds, SHA-256 checksum, opaque `bucket:path`, signed URL TTL ≤120s. **No** facial-landmark / out-of-mask / background / native-hair validators in FiOS 1A (HairAudit `outcomeValidation.ts` has those for OpenAI).

---

## 5. Domain model gaps (required correction)

FiOS must adopt HairAudit’s three-way split:

```text
artifact_type =
  graft_allocation_map
  | proposed_hairline_design
  | illustrative_projected_outcome
```

**Hard rule:** overlay / stub / colour renderer MUST NOT create `illustrative_projected_outcome`.

A photoreal record must reference (HairAudit already stores most of this in payload; FiOS jobs do not):

- approved surgical-plan version  
- approved hairline-design version  
- source photograph + view + treatment/preservation masks  
- graft allocation + density assumptions + hair characteristics  
- projection mode + provider/model + prompt/template version  
- source/mask/output checksums  

**Required FiOS schema migration themes:**

1. Add `artifact_type` (+ disallow stub/overlay → illustrative)  
2. Persist hairline design id/version, source view, mask checksums, prompt version  
3. Separate entitlements / audit events for generate / approve / share  
4. Optionally dual-write/link to HairAudit generation id for shared provenance  

---

## 6. Shared provider architecture (recommendation)

### Options

| Option | Verdict |
|---|---|
| A. FiOS owns OpenAI adapter only | Rejects HairAudit as consumer of same generation |
| B. HairAudit owns OpenAI only | Leaves FiOS clinic channel orphaned; forces photo copying if FiOS becomes SoR later |
| **C. Shared ImagingOS / projection service** | **Preferred** |

### Preferred: Option C — FiOS ImagingOS hosts the provider-neutral service

HairAudit already implemented the real OpenAI path. **Do not copy** that adapter into a second FiOS tree. Extract into the ImagingOS service consumed by both:

**Extract from HairAudit (reusable core):**

- `openaiGptImageProvider.ts` (+ storage binder)  
- `treatmentMask.ts` / containment composite  
- `openaiEditPrompt.ts` (prompt/template versioning)  
- `outcomeValidation.ts`  
- `artifactTypes.ts` + disclaimer constants  
- Idempotency key derivation:  
  `patient/case + planVersion + hairlineVersion + sourceImage + view + mode + provider/templateVersion`

**Remain product-specific:**

- Permissions, clinical approval UI, patient-report inclusion  
- Graft plan / annotation SoR (today HairAudit; FiOS clinic planning when promoted)  
- Presentation tabs and correction drawers  

**Service owner:** FiOS ImagingOS module (`src/lib/imaging-os/preSurgeryProjection`), already designed as multi-channel (`hairaudit_service` \| `fios_clinic`). Promote registry from stub → `openai-gpt-image` once extracted and evidenced.

HairAudit `imagingOsProvider.ts` should become the thin remote client again — **not** a second OpenAI implementation running in parallel without shared idempotency.

---

## 7. FiOS clinical workflow vs reality

| Required step | FiOS today |
|---|---|
| 1. Select suitable source image | Imaging exists; not wired to projection |
| 2. Create graft allocation plan | Text zones only |
| 3. Create/adjust proposed hairline | Consultation schematics only |
| 4. Approve plan + hairline version | Plan status exists; no hairline version SoR |
| 5. Generate frontal planned-mode illustration | Clinic channel returns 1B-not-enabled |
| 6. Technical validation | MIME/size/dims only (stub path) |
| 7–8. Clinician review / independent reject | Domain validators only; no UI |
| 9–10. Explicit patient share → downstream | Flag off; no consumer |

Rejecting a projection must not reject consultation / plan / graft allocation / hairline — **domain intent exists** (`clinicianReviewState` independent of plan tables); **no FiOS UI** exercises it.

---

## 8. OpenAI provider compatibility (`openai-gpt-image`)

| Requirement | FiOS | HairAudit |
|---|---|---|
| `provider_id = openai-gpt-image` | Absent | Present |
| Source-image **edit** (not from-scratch gen) | N/A | `client.images.edit` with source + mask |
| Recipient mask + hairline geometry | Accepts annotation IDs in canonical snapshot; stub ignores | Builds RGBA mask; hairline gate |
| No auto-approve / auto-share | Domain defaults to awaiting_review | Enforced; current row `clinician_review` / sharing false |
| Evidence of successful photoreal hair output | **None on FiOS** | Real JPEG + outcomeValidation on HA case above |

---

## 9. Validation & clinical controls

| Control | FiOS 1A | Needed |
|---|---|---|
| MIME / dims / byte size / decode | Yes | Keep |
| Storage object existence / checksum | Yes on upload | Keep |
| Source/outcome alignment | No | Port from HA |
| Facial landmark / face-band delta | No | Port from HA |
| Out-of-mask / background / native-hair | No | Port from HA |
| Mandatory clinician inspection | Domain state only | UI + checklist |

---

## 10. Patient & report protection

FiOS patient surfaces today expose **visual summary** (post-op education), **not** illustrative projected outcomes.

Required gates before any FiOS patient/report consumer:

- current approved surgical plan  
- approved hairline design  
- genuine `illustrative_projected_outcome`  
- valid provider/model provenance (not stub / local-illustrative)  
- technical validation pass  
- clinician approval  
- explicit sharing approval  

Exclude allocation maps, overlays, historical plans, rejected/failed/missing/stub assets.

Disclaimer (already correct in HairAudit; must be FiOS-canonical when FiOS shares):

> This image is an illustrative projection based on the proposed surgical plan and selected assumptions. It is not a guarantee of density, growth, coverage or final appearance. Actual outcomes vary with healing, graft survival, hair characteristics, progression of native hair loss and adherence to aftercare.

---

## 11. FiOS↔HairAudit ownership & synchronisation

| Concern | Recommendation |
|---|---|
| Surgical plan SoR | **HairAudit** for HA cases today; FiOS `fi_case_surgery_plans` for native FiOS clinic cases — must not silently diverge for linked cases |
| Hairline design SoR | **HairAudit** artifacts/annotations today; FiOS lacks SoR |
| Who requests generation | Product that owns the consultation context; both call **shared ImagingOS** |
| Generated asset owner | Shared ImagingOS storage with product-scoped ACL; opaque generation id |
| Clinical approval | **Product-specific** (reject in HA must not mutate FiOS plan; reject in FiOS must not mutate HA plan) — share eligibility may sync via events |
| How HA receives projection | Prefer ImagingOS sync response + generation id (fix `projectionId` callback gap) |
| HA reject/correct without changing FiOS plan | Allowed — correction requests event back to owning planner |
| Superseded plan invalidates sharing | Mark jobs stale / `superseded`; clear patient visibility |
| Duplicate generation prevention | Shared idempotency key across both products |
| Two “current” projections | Forbidden for same plan+hairline+source+view+mode+provider/template |

**Duplication risk (critical):** HairAudit OpenAI provider is live in HA DB while FiOS gateway sits empty. Enabling FiOS OpenAI **and** leaving HA OpenAI local creates twin generations. Extract first; single-write path second.

---

## 12. UX requirements (FiOS gap list)

Case/patient file must show: plan exists/version/approval, graft totals/zones, hairline approved?, photoreal exists?, lifecycle/approval, patient-sharing, valid thumbnail.

Separate panels: **Allocation Map | Hairline Design | Projected Outcome**.  
One shared review/correction drawer — no permanent correction forms under every record.

Today: `CaseSurgeryPlanningCard` is Stage 5B text readiness only — explicitly disclaims procedure-day / audits / outcomes.

---

## 13. Entitlements, privacy, audit (AU)

| Topic | Status |
|---|---|
| Tenant entitlement for generation | Missing (module flags only) |
| Generate / approve / share capabilities | Missing |
| Per-generation usage/cost | Missing |
| Source/output ACL | Service-role + private bucket designed |
| Signed URL expiry | ≤120s when used |
| Audit events | Structured logs in gateway; no durable clinician audit table on FiOS |
| Provider privacy / retention | OpenAI image edit implies offshore processing — need DPIA + patient notice before FiOS clinic enablement |
| Deletion/retention | Undefined for FiOS projection jobs |
| Australian patient-data | Treat facial photos + generated likeness as sensitive health information; keep buckets AU-region where possible; minimise cross-product copies |

---

## 14. Assets requiring reclassification (FiOS)

FiOS has **no projection assets** to reclassify.

HairAudit legacy rows still risky if mirrored into FiOS later without gates:

- stub `.stub` files labelled with legacy “Illustrative … projection” copy + `patient_sharing_enabled=true`  
- superseded allocation map still carrying old patientSafeLabel  

Do not import these into FiOS patient surfaces.

---

## 15. Implementation plan

1. **Freeze duplication** — decision: ImagingOS (FiOS) is sole photoreal generator; HA OpenAI becomes client or temporary sole runner with explicit deprecation plan.  
2. **Extract shared OpenAI package/service** from HairAudit into ImagingOS provider registry (`openai-gpt-image`).  
3. **Schema** — `artifact_type`, hairline refs, mask/prompt checksums, generation provenance, entitlements, audit events.  
4. **FiOS clinical SoR** — photo-bound graft allocation map + versioned hairline before clinic generation.  
5. **1B clinic UI** — request / review / approve / share / tabs / drawer.  
6. **Shared idempotency + projectionId callback fix**.  
7. **Patient/report gates** + disclaimer.  
8. **Privacy pack** — DPIA, retention, AU hosting, entitlement metering.

**Do not** implement a second independent FiOS OpenAI tree before step 1–2.

---

## 16. Tests & live validation plan

### Existing

```bash
npm run test:pre-surgery-projection-1a
```

### Add

- Artifact-type hard gates (overlay cannot mint illustrative)  
- OpenAI provider contract (edit-only, mask required, no auto-share)  
- Shared idempotency collision across HA + FiOS channels  
- Patient visibility exclusion matrix (stub/map/rejected/missing)  
- Reject projection ≠ reject plan  

### Live validation (when provider connected)

1. Enable non-prod flags + real provider  
2. Generate frontal planned illustrative for a pilot case with approved plan + hairline  
3. Prove hair texture, irregular hairline, density transition, mask containment, identity preservation  
4. Clinician approve independently; enable share explicitly  
5. Confirm stub/map never appear in patient projected-outcome section  
6. Confirm FiOS job row + HA consumer share one generation id  

---

## Status summary (report separately)

### Graft Allocation Map — **RED (FiOS)**

No coloured clinical zone map product. Only `planned_zones` JSON text on `fi_case_surgery_plans`. HairAudit has a GREEN local-illustrative map for its own case space — not FiOS-owned.

### Proposed Hairline Design — **RED (FiOS)**

No photo-bound, versioned, clinician-approved hairline design SoR. Consultation wireframes are schematic only. HairAudit has an approved hairline overlay artifact used as OpenAI gate.

### Photorealistic Projected Outcome — **RED (FiOS)**

Stub gateway; production blocked; zero jobs; zero objects; no clinic/patient UI. HairAudit has independent OpenAI jpeg candidates awaiting clinician review — **those do not make FiOS GREEN**.

### Cross-product synchronisation — **RED**

Designed HA→FiOS ImagingOS path is unused. HairAudit generates photoreal locally. High risk of duplicate implementations and twin “current” projections unless a shared ImagingOS service + shared idempotency key become mandatory.

---

## Evidence index

- FiOS gateway audit: `docs/audits/FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A.md`  
- FiOS module: `src/lib/imaging-os/preSurgeryProjection/`  
- Migration: `supabase/migrations/202611036001_imaging_os_pre_surgery_projection_1a.sql`  
- HA artifact types: `G:\hairaudit-v2\src\lib\preSurgeryIntelligence\projection\artifactTypes.ts`  
- HA OpenAI provider: `G:\hairaudit-v2\src\lib\preSurgeryIntelligence\projection\openaiGptImageProvider.ts`  
- HA photoreal audit: `G:\hairaudit-v2\docs\hairaudit\audits\HA-PRE-SURGERY-PHOTOREALISTIC-OUTCOME-2A.md`  
- Live DBs inspected (read-only): Follicle Intelligence `iqqvzgxoimxchhcnbzxl`; HairAudit `vbzjkqhvzfunahmlxevb`
