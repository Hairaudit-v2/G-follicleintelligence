# FI-HUBSPOT-IMPORT-1E-Q — Quarantine/exclusion classification assurance

**Verdict:** GREEN  
**Date:** 2026-07-17  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`  
**Workspace:** `/fi-admin/.../settings/integrations/hubspot?tab=quarantine-review`

## Outcome

Classification/assurance gate completed for the frozen **110** HubSpot contacts
(100 quarantined + 10 excluded). Every record received an explicit final state.
Reclassified contacts remain **unapplied**. FI leads, mappings, patients, staff,
users, tasks, messages, appointments, staging deletes, and watermarks were not
mutated.

**Exact next gate:** `FI-HUBSPOT-IMPORT-1E-FINAL`

## Fixed boundaries

| Boundary | Value |
|---|---|
| Source cutoff | `2026-07-16T16:00:34.530Z` |
| Base inventory checksum (1E-R) | `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c` |
| Post-1E-C inventory checksum | `93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451` |
| Fixed 1E-Q inventory checksum | `fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6` |
| Review checksum | `d81b2249d4386b7df46cd7bb4d4ca73597932ba3eb13434de8d66c37f97c634c` |
| Frozen cohort | 110 exact HubSpot contact IDs (reject drift) |

## Final classification counts

| State | Count |
|---|---:|
| `retained_test_or_smoke` | 59 |
| `retained_ambiguous_identity` | 8 |
| `excluded_archived_without_business_value` | 9 |
| `reclassify_existing_lead_link` | 26 |
| `reclassify_patient_review` | 8 |
| **Retained** | **67** |
| **Excluded** | **9** |
| **Reclassified (read-only)** | **34** |
| **Deferred** | **0** |

Original excluded cohort: 9 archived retained + 1 reclassified existing-lead =
10. Original quarantined cohort: 67 retained + 33 reclassified = 100.

## Reclassified cohorts (unapplied)

### Existing lead link (26)

`150450600528`, `1939253`, `225728757851`, `79937771043`, `79937800582`,
`79937855002`, `79941467568`, `79943989859`, `79944728184`, `79944924182`,
`79944957972`, `79944957976`, `79945774437`, `79947255323`, `82403224498`,
`82404694172`, `82405221734`, `82412704052`, `82412949557`, `82416191883`,
`82416373824`, `82417941556`, `82420678517`, `82423699231`, `82427020898`,
`82427023222`

### Patient review (8)

`228149575980`, `228157036818`, `230741985397`, `231956151096`,
`233032948147`, `233915878521`, `82410538778`, `82431051267`

These are **not** the frozen 1E-P patient-review cohort of four contacts. 1E-P
records remain untouched.

### Create candidates

None from this quarantine/exclusion cohort.

## Reconciliation

```
4606 mapped
+ 31 deferred create
+ 1 duplicate-risk create
+ 4 deferred patient review
+ 76 retained quarantine/exclusion
+ 34 reclassified read-only
+ 0 deferred manual review
= 4752
```

Unexplained: **0**  
Wrong tenant: **0**

## Mutation and replay proof

| Check | Result |
|---|---|
| Patients | 829 → 829 |
| Leads | 4716 → 4716 |
| Contact→lead mappings | 4606 → 4606 |
| Staging rows | 4752 → 4752 |
| Notes watermark | unchanged (`2026-07-16T16:00:34.530Z`) |
| Idempotent classify replay | checksum stable; mutation delta outside review state = 0 |
| Apply probe | blocked (`fi_crm_leads` insert forbidden) |

Allowed writes: review provenance on `fi_hubspot_contact_lead_pilot_decisions`
only (`review_state`, checks, checksums, operator/timestamp). Inventory
`reason_code` is intentionally not overwritten so signature drift is avoided
after the repair pass.

## Workspace / permissions

- Tab: `quarantine-review`
- Roles: clinic admin / operations admin / owner / platform admin
- Primary view: masked names, HubSpot IDs, plain-language warnings; raw DB IDs
  hidden unless audit details expanded
- Filters: all / possible legitimate / retained / excluded / reclassified /
  deferred + search

## Verification

- Focused unit tests: **26 passed** (1E-C + 1E-P + 1E-Q)
- Typecheck/lint: see commit verification
- Operator smoke: inventory → classify → replay → apply-blocked

Temporary operator artifacts (not committed; may include broader payloads):

- `docs/audits/.tmp-import-1e-q-inventory.json`
- `docs/audits/.tmp-import-1e-q-classify.json`
- `docs/audits/.tmp-import-1e-q-replay.json`
- `docs/audits/.tmp-import-1e-q-apply-blocked.json`

Structured privacy-safe evidence:
`docs/audits/evidence-fi-hubspot-import-1e-q-quarantine-review.json`

## Residual risks

- 34 reclassified contacts remain unapplied until `FI-HUBSPOT-IMPORT-1E-FINAL`
- Live inventory resolves the 1E-C duplicate-risk contact as `create_new_lead`
  because the saved 1E-C milestone does not override expansion inventory; the
  programme still accounts for it as 1 duplicate-risk create candidate
- 8 newly reclassified patient-review contacts are separate from the 1E-P four
- Inventory checksum advanced from post-1E-C `93823b3d…` to post-1E-Q
  `fcf3aadd…` while total contacts remained 4752

## STOP

Do **not** apply reclassified lead links, patient links, or create candidates at
this gate. Proceed only under **FI-HUBSPOT-IMPORT-1E-FINAL**.
