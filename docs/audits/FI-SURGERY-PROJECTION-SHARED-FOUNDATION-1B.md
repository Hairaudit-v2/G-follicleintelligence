# FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B

**Date:** 2026-08-07  
**Prior audit:** `docs/audits/FI-SURGERY-PHOTOREALISTIC-PROJECTION-AUDIT-1A.md`  
**Paid generation:** not invoked  

---

## Status (report separately)

| Surface | Status | Notes |
|---|---|---|
| 1. Shared projection foundation | **AMBER** | Contracts + schema + service façade shipped; OpenAI adapter not yet relocated into shared runtime (explicit deployment blocker) |
| 2. FiOS Graft Allocation Map | **GREEN** | Zone grafts/density/deferred + SVG clinical map; `artifact_type=graft_allocation_map` |
| 3. FiOS Proposed Hairline Design | **GREEN** | Photo-bound versioned SoR (`fi_case_hairline_designs`) + create/edit/approve/reject UI with rendered line |
| 4. FiOS Photorealistic Projected Outcome | **RED** | Readiness + external HA inspection only; no FiOS-approved generation |
| 5. Cross-product synchronisation | **AMBER** | Shared tables + product_refs + idempotency foundation; end-to-end sync not demonstrated |
| 6. Patient sharing | **RED** | Intentionally deferred — capability always denied in 1B |

---

## 1. Shared-service ownership decision

**Owner:** ImagingOS shared capability (`@follicle/projection-core` + `imaging_os_projection_*` tables + `src/lib/imaging-os/sharedProjection/`).

**Consumers:** FiOS, HairAudit, future PatientOS — via request contract + product_refs.

**FiOS remains SoR for:** surgical plan, graft allocation, approved hairline design.

**Shared service owns:** generation request, provider invocation (when wired), technical lifecycle, asset ref, provider/model/prompt provenance, technical validation, immutable checksum.

**Products retain:** clinical decision, audit decision, patient-sharing approval, presentation rules.

**Do not** treat “approved” as a shared technical lifecycle state.

---

## 2. Extract inventory (HairAudit → shared)

Full list: `HAIRAUDIT_EXTRACT_INVENTORY` in `packages/projection-core/providerBoundary.ts`.

| Classification | Examples |
|---|---|
| shared_provider_infrastructure | openaiGptImageProvider, treatmentMask, maskContainmentComposite, openaiEditPrompt, localIllustrative (overlay-only) |
| reusable_validation_library | outcomeValidation, asset/output validation |
| hairaudit_specific_domain_logic | hairlineApprovalGate (HA), imagingOsProvider client, HA service/stateMachine |
| product_specific_ui_workflow | approval.ts, patientVisibility, report inclusion |

**1B extraction completed as contracts + inventory** — OpenAI SDK tree was **not copied** into FiOS. Relocate HA adapter behind `SharedProjectionProvider` in a follow-up ticket before paid generation.

---

## 3. Schema / migration

`supabase/migrations/202611126001_imaging_os_projection_shared_foundation_1b.sql`

Applied to Follicle Intelligence (`iqqvzgxoimxchhcnbzxl`).

Tables:

- `imaging_os_projection_generations`
- `imaging_os_projection_product_refs`
- `imaging_os_projection_usage_events`
- `fi_case_hairline_designs`
- `fi_case_surgery_projection_events`

Bucket: private `pre-surgery-projections` (unchanged/upserted).

---

## 4. Contracts

Package: `@follicle/projection-core`

- Artifact types + hard overlay ban on illustrative outcomes  
- Request `fi-shared-projection-request-v1`  
- Response `fi-shared-projection-response-v1` (`clinicallyApproved: false`, `patientShareable: false` always from service)  
- Lifecycle states per ticket (no unqualified `approved`)  
- Idempotency: subject + plan/version + hairline/version + source/mask checksums + view + mode + provider + model + prompt version  

---

## 5. FiOS clinical foundation

- Extended `planned_zones` with grafts, density, deferred, unassessed, polygonNorm  
- Allocation map SVG renderer (`AllocationMapTab`)  
- Hairline SoR + mutations/loaders + controls (central height, recession, symmetry, temporal, irregularity, anterior depth)  
- Three-tab UI on case detail: Allocation Map | Hairline Design | Projected Outcome  
- One review/correction drawer  

---

## 6. HairAudit OpenAI asset inspection (2791b827…)

| Field | Finding |
|---|---|
| Provider/model | `openai-gpt-image` / `gpt-image-2` |
| Output | JPEG 743 044 B, 1799×2400, checksum `7cef5d61…` |
| Source checksum | `0451b327…` |
| Mask checksum | `fde4f691…` |
| Hairline gate | Bound to approved design `3af857db…` |
| Zone polygons | Mostly defaults (recipient annotation ids empty) |
| Automated validation | Pass (face/out-of-mask metrics) |
| Live clinical status | **rejected** — horizontal composite seam |
| FiOS subject mapping | **Not verified** |
| FiOS display | Isolated — not “awaiting FiOS clinical review” |

No additional paid images generated.

---

## 7. Privacy assessment (AU)

| Topic | Position |
|---|---|
| OPENAI_API_KEY present | **Not** sufficient privacy approval |
| Data sent on edit | Patient facial photograph + mask leave tenancy to OpenAI |
| Suitability | Requires DPIA, DPA/BA, patient notice, retention alignment before FiOS clinic generation |
| FiOS 1B | No OpenAI call from FiOS path |
| Storage | Private bucket; service_role; short-lived signed URLs when used (≤120s in existing gateway) |
| Entitlements | Capability keys defined; patient sharing always denied in 1B |
| Usage ledger | `imaging_os_projection_usage_events` |

---

## 8. Deployment requirements

1. Migration applied (done on FI project) — apply to other environments via normal pipeline  
2. Deploy app with `@follicle/projection-core` path alias  
3. Do **not** enable paid provider until adapter extracted and DPIA signed  
4. Keep `FI_PRE_SURGERY_PROJECTION_*` stub flags as-is for HA gateway compatibility  

**Explicit AMBER blocker for Shared foundation → GREEN:** relocate HairAudit `openaiGptImageProvider` behind `SharedProjectionProvider` without duplication; prove one idempotent generation shared by FiOS + HA consumers.

---

## 9. Tests

```bash
npm run test:surgery-projection-1b
npm run check:migrations
```

Coverage: artifact separation, overlay ban, hairline geometry, allocation map labelling, idempotency, prerequisites, capability deny for sharing, external asset isolation, extract inventory.

---

## 10. Screenshots

UI implemented on case surgery planning section. Capture after deploy:

1. Allocation Map tab with zones/grafts  
2. Hairline Design tab with rendered line + controls  
3. Projected Outcome tab showing readiness + isolated HA notice  
4. Review drawer  

Interactive audit board may be updated separately.

---

## 11. Remaining blockers

1. Physical OpenAI provider extract into shared runtime  
2. Real photo URL binding for allocation/hairline overlays (storage signed URL in UI)  
3. Cryptographic source checksum on hairline create (replace client placeholder)  
4. Verified FiOS↔HA subject/case mapping before showing external assets  
5. DPIA / AU provider privacy pack  
6. End-to-end shared idempotency demo across both products  
7. Patient sharing (deferred)  

---

## Key paths

- `packages/projection-core/`  
- `src/lib/imaging-os/sharedProjection/`  
- `src/lib/cases/surgeryProjection/`  
- `src/components/fi-admin/cases/surgery-projection/`  
- `lib/actions/fi-hairline-design-actions.ts`  
- `supabase/migrations/202611126001_imaging_os_projection_shared_foundation_1b.sql`  
- `tests/surgeryProjectionSharedFoundation1b.test.ts`  
