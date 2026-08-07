# DPIA — Shared Photorealistic Surgery Projection (OpenAI gpt-image)

**Ticket:** FI-SURGERY-PROJECTION-PROVIDER-ACTIVATION-1C  
**Date:** 2026-08-07  
**Owner:** ImagingOS / Follicle Intelligence platform  
**Decision:** **APPROVED WITH CONDITIONS**

> Technical availability of an OpenAI API key is **not** privacy approval.  
> Identifiable clinical photographs must not be sent unless the conditions below are met.

---

## 1. Decision

| Field | Value |
|---|---|
| Outcome | **APPROVED WITH CONDITIONS** |
| Scope | Controlled clinician-only pilot of illustrative projected outcomes via SharedProjectionProvider |
| Production open enablement | **Blocked** until conditions satisfied and recorded |
| Patient sharing | **Not approved** (remains deferred / unavailable) |
| Recorded by | Platform owner (operator acknowledgment via env `FI_SHARED_PROJECTION_DPIA_STATUS=approved_with_conditions`) |
| Review date | 2026-08-07 |
| Next review | Before expanding beyond pilot allowlist |

---

## 2. Processing description

| Topic | Assessment |
|---|---|
| Data categories | Clinical facial/scalp photographs; treatment/preservation masks; opaque subject/case IDs; graft-plan summaries in prompts; provider metadata |
| Sensitivity | **High** — health information; photographs are likely identifiable |
| Facial identifiers | Yes — frontal clinical photographs ordinarily contain identifiable facial information |
| Purpose | Generate an *illustrative* photoreal projected surgical outcome for clinician review only |
| Lawful basis (AU APP context) | Health service delivery / reasonable patient expectation **only if** clinic has collected photographs for clinical planning **and** patient notice/consent covers third-party image processing for planning illustrations. Pilot clinics must confirm locally before enablement. |
| Patient disclosure / consent | Required before any new clinic-image request: notice that an overseas AI image processor will edit the photograph; illustrative (non-guarantee) nature; clinician-only until separately approved for patient view |
| Overseas disclosure | Yes — OpenAI Images API processes image bytes outside Australia (default US regions unless separately contracted) |
| OpenAI retention / project controls | Must use a dedicated OpenAI project with API data controls aligned to “do not train”; confirm retention settings before pilot; record project ID in ops notes (not in app logs) |
| Account/project data controls | Service API key server-side only; rotate on staff change; restrict project membership |
| Storage regions / transfer path | FiOS private bucket `pre-surgery-projections` (Supabase) → server memory → OpenAI API → server memory → private bucket. Signed URLs short-lived; never logged. |
| Human access risk | Platform operators with service_role; clinician users with inspect capability; OpenAI subprocessors per their DPA |
| Subprocessors | OpenAI, LLC (image edit); infrastructure hosting (Vercel/Supabase) per existing platform DPIA |
| Logging / observability | Correlation IDs, opaque subject refs, checksums, lifecycle, cost — **no** source images, masks, signed URLs, prompts with names, or credentials |
| Deletion / retention | Generation assets follow tenant clinical imaging retention; temporary buffers discarded after request; OpenAI retention per project settings |
| Breach response | Treat facial clinical image disclosure as notifiable health privacy incident; revoke keys; quarantine generation IDs |
| Tenant contractual requirements | DPA + overseas disclosure schedule + AI image-processing addendum before pilot tenant goes live |

---

## 3. Controls confirmed / required

1. Source photographs are not placed in application logs.  
2. Signed URLs and credentials are not sent in telemetry.  
3. Prompts contain no patient names/MRNs — only opaque plan/zone/graft assumptions.  
4. Provider request metadata uses opaque subject references.  
5. Temporary files/buffers have request-scoped retention only.  
6. Production clinic-wide enablement is blocked until this decision remains recorded and tenant is allowlisted.  
7. Patient sharing capability remains denied.  
8. No automatic clinical approval of provider output.

---

## 4. Conditions for any paid clinical-image call

Gate fails closed unless **all** are true:

1. `FI_SHARED_PROJECTION_DPIA_STATUS` is `approved_with_conditions` or `approved_for_controlled_pilot`.  
2. Runtime environment is allowlisted (`development` / `preview` / explicit production pilot).  
3. Tenant UUID is on `FI_SHARED_PROJECTION_PILOT_TENANT_IDS`.  
4. Requesting user holds generation capability; clinic channel or HairAudit service auth succeeds.  
5. Surgical plan **and** photo-bound hairline design are currently approved (not stale/superseded).  
6. Source + treatment (+ preservation) masks exist with matching checksums.  
7. View = `frontal`, mode = `planned` for pilot.  
8. Estimated cost ≤ configured ceiling.  
9. Provider enabled with valid model/config; missing config → refuse (no overlay fallback).  
10. Operator has reviewed the preflight pilot record (tenant, case, plan/hairline versions, refs, graft total, assumptions, estimated cost) before confirming.

If any condition fails: **do not send patient images to OpenAI.** Use synthetic fixtures for technical proofs and return readiness **READY FOR CONTROLLED PILOT** / **BLOCKED** as applicable.

---

## 5. Acceptability for Australian patient photographs

**Acceptable for a controlled clinician-only pilot under the conditions above.**  
**Not acceptable** for patient-facing sharing, open production, multi-mode marketing renders, or uncontrolled tenant enablement.

---

## 6. Rejected HairAudit asset (reference)

Asset `2791b827-…` remains isolated (visible seam; not FiOS-approved; not shareable). Used as regression context only — never imported as a current FiOS outcome.
