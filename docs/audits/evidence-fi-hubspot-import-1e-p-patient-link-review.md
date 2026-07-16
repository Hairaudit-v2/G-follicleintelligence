# FI-HUBSPOT-IMPORT-1E-P — Patient-link clinical identity interim review

**Verdict:** AMBER — read-only interim complete; **explicit human approval required before any apply**  
**Date:** 2026-07-17  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## STOP — approval required

This gate is **read-only interim only**. No patient link, patient create/merge/modify, or
production relationship write was executed. Apply remains disabled until an explicit
human approval under the next gate.

**Exact next gate after approved 1E-P completion:** `FI-HUBSPOT-IMPORT-1E-Q`

## Fixed source boundary

| Field | Value |
|-------|-------|
| Base inventory checksum (1E-R) | `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c` |
| Post-1E-C live inventory checksum | `93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451` |
| Source contacts | 4,752 |
| Source cutoff | `2026-07-16T16:00:34.530Z` |
| Patient-review cohort | 4 (frozen; drift rejected) |
| Immutable review checksum | `9328b13004682436b9575c7fd2f5f514b12f4d4b932a4fe329ea3871ec74518f` |
| Proposed production links | **0** (maximum permitted later: 2) |

The live inventory checksum differs from the 1E-R base only because the reconciled 1E-C
create batch moved 10 contacts out of the create-candidate decision set. Total contacts
remain 4,752; the four patient-review IDs are unchanged.

## Frozen cohort (exact four IDs)

| HubSpot contact ID | Proposed state | Possible patient target | Reason |
|---|---|---|---|
| `229708595090` | `deferred_clinical_identity_review` | `49b0db10-539a-49c4-9379-1f09a6b3681b` | email-only never approves |
| `233738855995` | `deferred_clinical_identity_review` | `8cf53e2a-e5fa-41f7-9018-e808a5df1425` | email-only never approves |
| `234062240678` | `deferred_clinical_identity_review` | `1b8ccda6-4570-4bc0-9f03-400bc6c98d81` | email-only never approves |
| `234339716176` | `deferred_clinical_identity_review` | `f6facf54-dcb1-460f-affd-5d6bebcc72ce` | email-only never approves |

## Evidence summary (privacy-safe)

Every record was reviewed with same-tenant staging, person/patient source IDs, contact→lead
and contact→patient mappings, exact email→person→patient identity, exact phone identity,
trusted lead→patient relationship presence, appointment association presence, and
consultation association presence. Clinical note content was not loaded or shown.

For all four contacts:

- email overlap with exactly one same-tenant patient (weak signal)
- no exact phone patient match
- no HubSpot patient/person source ID
- no contact→lead mapping and no trusted lead→patient relationship
- no appointment/clinical association reinforcing a second identifier
- no multi-patient conflict

Email-only evidence **never** approves a patient link. Default fail-closed state:
`deferred_clinical_identity_review`.

## Proposed mappings / mutation plan

| Metric | Value |
|--------|------:|
| Proposed production links | 0 |
| Batch max (if later approved) | 2 |
| Expected mutations if approved later | none (zero links) |
| Patient create | forbidden |
| Patient merge/modify | forbidden |
| Relationship write until approval | forbidden |

## Patient-protection result

| Entity | Before | After | Delta |
|--------|-------:|------:|------:|
| `fi_patients` | 829 | 829 | 0 |
| `fi_patient_source_ids` | 208 | 208 | 0 |
| `fi_crm_leads` | 4,716 | 4,716 | 0 |
| Contact→lead mappings | 4,606 | 4,606 | 0 |
| Contact→patient mappings | 0 | 0 | 0 |
| Notes watermark | `2026-07-16T16:00:34.53+00:00` | unchanged | 0 |

Staff, users, tasks, messages, notifications, bookings, and watermarks were unchanged.
Decision provenance may update `fi_hubspot_contact_lead_pilot_decisions` only.

## Apply probe

Apply without explicit human approval returned:

`APPROVAL_GATE: FI-HUBSPOT-IMPORT-1E-P apply is blocked until explicit human approval`

## Workspace

`/fi-admin/[tenantId]/settings/integrations/hubspot?tab=patient-review`

Tenant-scoped authorised clinical identity roles; audited access; summary/filter/search;
CRM vs patient identity visually distinct; plain-language evidence; warnings; audit details
hidden from the primary screen; persistent decisions; apply control disabled.

## Risks

- Email-only patient overlap can still confuse operators; deferred state must remain until
  a second reliable identifier or trusted lead→patient relationship is proven.
- Post-1E-C inventory checksum must be held; further inventory drift fails closed.
- Zero links is an acceptable and expected interim outcome when evidence is insufficient.

## Verification

- Focused 1E-P unit tests: pass (identity, approval gate, stale checksum, role, batch max 2,
  side-effect/watermark/idempotency/rollback policy guards)
- HubSpot workspace route tests: pass (includes `patient-review` tab)
- Operator smoke: inventory → classify → preview → apply-blocked

## Artifacts

- `docs/audits/.tmp-import-1e-p-inventory.json`
- `docs/audits/.tmp-import-1e-p-classification.json`
- `docs/audits/.tmp-import-1e-p-preview.json`
- `docs/audits/.tmp-import-1e-p-apply-blocked.json`
- `docs/audits/evidence-fi-hubspot-import-1e-p-patient-link-review.json`
