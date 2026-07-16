# FI-HUBSPOT-IMPORT-1E-C — Controlled new-lead candidate review

**Verdict:** GREEN — all 42 candidates classified; first 10-record batch applied and reconciled  
**Date:** 2026-07-17  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Fixed source boundary

- 1E-R inventory checksum:
  `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c`
- Source cutoff: `2026-07-16T16:00:34.530Z`
- Source contacts: 4,752
- Candidate population: 42
- Patient-review records in the wider inventory: 4, unchanged and out of scope
- Candidate review checksum:
  `8b0b22f9d30deff76672ba58e963976c579fb2fb7f835fe111f85d519ce63abd`

## Complete candidate classification

| Explicit review state | Count |
|---|---:|
| `approved_create_new_lead` | 10 |
| `deferred_manual_review` | 31 |
| `quarantine_duplicate_risk` | 1 |
| All other allowed review states | 0 |
| **Total** | **42** |

Every candidate was checked against the same tenant's contact mappings, person
source IDs, patient source IDs, exact normalized email, exact normalized phone,
candidate-cohort duplicate signals, archived state, minimum identity, invalid or
smoke signals, source payload checksum, and fixed source cutoff. The first batch
was selected deterministically from the candidates that passed every check.
Approval was capped at 10; no bulk auto-approval occurred.

## Frozen first batch

- Batch: `32d02f20-9852-4be2-b237-45c115f43c2b`
- Preview checksum:
  `6ee2b1f4408bd9f66f3a7f346dc57bb9ac6fe85e19db28125048ce82b6814d2c`
- Approved creates: 10
- Existing-lead links: 0
- Patient-review rows: 0
- Maximum permitted size: 10

An earlier empty generic preview was rejected before apply and closed as
`rolled_back`; it created no FI records.

## Production apply

| Entity | Before | After | Delta |
|---|---:|---:|---:|
| `fi_crm_leads` | 4,706 | 4,716 | +10 |
| `fi_persons` | 4,861 | 4,871 | +10 |
| `fi_person_source_ids` | 4,690 | 4,700 | +10 |
| HubSpot contact→lead mappings | 4,596 | 4,606 | +10 |
| `fi_patients` | 829 | 829 | 0 |

Independent production verification found exactly 10 batch-owned leads, 10
batch-owned mappings, and 10 batch-owned person source IDs. Every created lead
has `patient_id = null`.

The following remained unchanged through apply and replay:
`fi_staff`, `fi_users`, `fi_crm_tasks`, `fi_crm_messages`,
`fi_reception_tasks`, `fi_admin_notifications`, `fi_bookings`, and every
HubSpot backup watermark. The notes watermark stayed
`2026-07-16T16:00:34.53+00:00`. No notifications, tasks, messages,
appointments/bookings, patients, staff, or users were created or mutated.

## Reconciliation, replay, and rollback

- Apply: created 10, linked 0, side effects 0
- Reconciliation: approved 10, new leads 10, unexplained 0, balanced
- Replay: created 0, already applied 10, all entity/mapping deltas 0
- Replay reconciliation: unexplained 0, balanced
- Rollback preview: 10 removable mappings, 10 eligible new leads, 0 blocked
- Rollback was **not** executed

## Workspace and guards

The contact-migration tab now presents a 1E-C candidate workspace with search,
filters, explicit review-state display, a fixed maximum of 10, typed batch-ID
confirmation, and a stop state after first-batch reconciliation. The apply path
rechecks mappings, person sources, exact email/phone identity, duplicate risk,
patient identity, source freshness, and payload checksums before writing.

Allowed writes are limited to batch/decision provenance, persons and person
source IDs required by a lead, leads, and external mappings. Patient creation
remains forbidden.

## Verification

- Full HubSpot import regression suite: 98 passed
- Focused identity, patient, duplicate, batch, checksum, and replay subset:
  59 passed
- IDE lint diagnostics for changed files: 0
- Full TypeScript check reached one unrelated pre-existing error:
  `tests/onboardingOsGuidedAssist.test.ts:143` is missing `todayHomeViews`

## Remaining population and next gate

After the first batch:

- mapped/applied: 4,606
- remaining create-candidate cohort: 32
  - deferred manual review: 31
  - duplicate-risk quarantine: 1
- patient review: 4, unchanged and out of scope
- pre-existing quarantined: 100
- excluded: 10
- unexplained / wrong tenant: 0

Stop before a second creation batch.

**Next gate:** `FI-HUBSPOT-IMPORT-1E-P`
