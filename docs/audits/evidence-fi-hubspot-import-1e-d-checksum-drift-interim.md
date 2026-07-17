# FI-HUBSPOT-IMPORT-1E-D — Inventory checksum drift reconciliation (interim)

**Verdict:** AMBER — operational safety proven; replacement checksum awaits explicit approval  
**Status:** `INTERIM_AWAITING_EXPLICIT_FREEZE_APPROVAL`  
**Date:** 2026-07-17  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`  
**Source cutoff:** `2026-07-16T16:00:34.530Z`

No Supabase mutation was executed. Counts and watermarks were captured before and
after reconciliation and were identical. The replacement checksum has **not**
been frozen.

## Executive conclusion

The drift is fully attributable to an incomplete, unordered decision-table read
in checksum contract v1:

1. The source-contact loader correctly paginated all 4,752 staging contacts.
2. The decision loader performed one PostgREST request with no explicit order or
   pagination, so it consumed at most one implicit page.
3. Persisting the 110 1E-Q reviews superseded and inserted decision-evidence
   rows. This safely enriched review evidence but changed which active decisions
   happened to appear in the unordered capped page.
4. One mapped contact, `22136828309`, consequently used its equivalent derived
   reason code instead of its persisted reason code.
5. Its primary classification, FI target, source fields, patient warning,
   quarantine reason, and applied mapping did not change.
6. Loading all decision rows with deterministic pagination makes Snapshot A and
   Snapshot B identical under the proposed v2 contract.

Root-cause categories:

- `expected_classification_evidence_enrichment`
- `inventory_scope_change`
- `serialization_or_ordering_change`

There is no source-record drift, unsafe classification change, mapping-target
change, patient-review change, or production mutation.

## Interim checksum decision

| Item                          | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Original expected v1 checksum | `fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6` |
| Prior live v1 checksum        | `b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a` |
| Original contract             | `fi-hubspot-contact-inventory-v1`                                  |
| Proposed contract             | `fi-hubspot-contact-inventory-v2`                                  |
| Canonical Snapshot A checksum | `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b` |
| Canonical Snapshot B checksum | `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b` |
| Proposed replacement checksum | `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b` |
| Replacement frozen            | **No**                                                             |

Explicit approval is required before the v2 checksum is frozen.

## Snapshot provenance

### Snapshot A — expected inventory

- Reconstructed from production decision history at
  `2026-07-16T23:40:16.711Z`, the timestamp retained in
  `docs/audits/.tmp-import-1e-q-inventory.json`.
- The legacy reconstruction produces the exact expected checksum
  `fcf3aadd...0805de6`.
- Source artifact commit:
  `aeea60d805ee24640c50119b44c1007bb6ad5f66`.
- Original checksum implementation introduced by:
  `0a49dc3079bd22c11924b2ce3aa4e52cb6090288`.
- Contact count: 4,752.
- Source cutoff: `2026-07-16T16:00:34.530Z`.

### Snapshot B — current live inventory

- Generated read-only from current production.
- The legacy loader reproduces the observed checksum
  `b12aacbc...2a696a`.
- The corrected complete decision loader produces the same v2 checksum as
  Snapshot A.
- Contact count: 4,752.
- Source cutoff unchanged.
- No staging row was updated after the expected snapshot.

Both complete privacy-safe snapshots are retained locally as evidence.

## Checksum input contract

### v1 — historical

- Entity type: HubSpot contact.
- Included population: the 4,752 unique staged contacts for the fixed tenant and
  integration.
- Field order:
  `hubspotContactId`, `decision`, `reasonCode`, `proposedLeadId`,
  `patientProtectionWarning`, `quarantineReason`, `identityTier`,
  `payloadChecksum`, `lastSourceActivityAt`.
- Row serialization: pipe-delimited fields.
- Inventory serialization: newline-delimited rows.
- Ordering: lexicographic sort of complete serialized rows.
- Null/undefined: empty string.
- Blank: empty string.
- Timestamp: serialized verbatim.
- Email and phone: normalized upstream for identity resolution but not directly
  serialized.
- Payload checksum: declared by the row contract but not fetched by the v1
  loader, therefore effectively blank.
- Source cutoff, tenant, integration, and contract version: not included in the
  hash.
- Algorithm: SHA-256.

### v2 — proposed

- Complete deterministic pagination of source contacts and decision rows.
- Decision rows ordered by HubSpot contact ID before paging.
- Fixed-position JSON-array serialization.
- Rows ordered by HubSpot contact ID.
- Valid timestamps canonicalized with `Date.toISOString()`.
- Staging `payload_checksum` fetched and included.
- Contract version, entity type, tenant, integration, and source cutoff included
  in the canonical hash input.
- Null/undefined/blank remain deterministic empty strings.
- Algorithm: SHA-256.

Object-key ordering cannot affect either contract because neither serializes
objects by key iteration.

## Record-level delta

### Source and identity set

- Added IDs: none.
- Removed IDs: none.
- Duplicate source IDs: 0.
- Wrong-tenant records: 0.
- Archived staging contacts: 10, all retained in the reconciled source set.
- Staging rows updated after Snapshot A: 0.
- Cross-tenant staging rows for the integration: 0.
- Source-field changes: 0.
- Normalized-value changes affecting inventory: 0.
- Pagination omissions after v2 correction: 0.
- Pagination proof: 4,752 records loaded in deterministic 1,000-row pages.
- Unexplained additions or omissions: 0.

### Legacy v1 changed record

| Field                     | Old                                    | New                                   |
| ------------------------- | -------------------------------------- | ------------------------------------- |
| HubSpot contact ID        | `22136828309`                          | `22136828309`                         |
| Primary classification    | `already_applied`                      | `already_applied`                     |
| Reason code               | `person_source_id_single_lead`         | `existing_external_lead_or_source_id` |
| FI lead target            | `dc3fe85f-1f69-4c51-b3b5-b811e08e1821` | unchanged                             |
| Identity tier             | `tier1_external_identity`              | unchanged                             |
| Source modified timestamp | `2026-02-11T06:17:57.524Z`             | unchanged                             |
| Patient warning           | none                                   | none                                  |
| Quarantine reason         | none                                   | none                                  |
| Follow-up                 | none                                   | none                                  |

Both reason codes describe the same safe, already-applied external identity. The
persisted decision history remains present and still records
`person_source_id_single_lead`; the legacy live checksum omitted that saved row
only because of the incomplete unordered decision read.

### Canonical v2 delta

- Changed contacts: 0.
- Classification changes: 0.
- Mapping-target changes: 0.
- Patient-review changes: 0.
- Source-field changes: 0.
- Ordering/serialization-only differences: 0.
- Unexplained changes: 0.

## Mutually exclusive programme reconciliation

| Primary state                                |     Count |
| -------------------------------------------- | --------: |
| Mapped                                       |     4,606 |
| Deferred create candidate                    |        31 |
| Deferred duplicate-risk create               |         1 |
| Deferred original patient identity review    |         4 |
| Retained test or smoke                       |        59 |
| Retained ambiguous identity                  |         8 |
| Excluded archived without business value     |         9 |
| Deferred existing-lead-link reclassification |        26 |
| Deferred patient identity reclassification   |         8 |
| **Total**                                    | **4,752** |

Secondary 1E-Q review flags are recorded separately and are not double-counted
as primary states: 59 retained test/smoke, 8 retained ambiguous, 9 excluded,
26 existing-lead reclassifications, and 8 patient-review reclassifications.

## 1E-Q outcome preservation

- 110/110 reviewed records retain an explicit review state.
- Missing operator, timestamp, or reason evidence: 0.
- Approved for apply: 0.
- Applied: 0.
- Reclassified existing-lead candidates unapplied: 26.
- Reclassified patient-review candidates unapplied: 8.
- No record lost its persisted review evidence.
- Generic operational quarantine remains the primary fail-closed state; the
  richer `review_state` remains the secondary auditable outcome.

## Mapping and patient safety

For changed contact `22136828309`:

- Same tenant and integration.
- Exactly one HubSpot contact-to-lead mapping.
- Same FI lead target.
- No duplicate or conflicting mapping.
- No patient warning.
- No patient source mapping.
- No new lead creation.

Production remains:

- FI leads: 4,716.
- FI patients: 829.
- Contact-to-lead mappings: 4,606.
- HubSpot patient source links: 0.
- Wrong-tenant mappings: 0.
- Duplicate contact mappings: 0.

All 12 patient-review records remain unapplied: four original primary review
records plus eight 1E-Q secondary reclassifications. No patient relationship or
patient source mapping was added.

## 1E-C batch accounting

- Completed non-empty creation batches: 1.
- Completed batch:
  `32d02f20-9852-4be2-b237-45c115f43c2b`.
- Leads created: 10.
- Current batch-scoped external mappings: 10.
- Current batch contact person-source IDs: 10.
- Distinct persons: 10.
- Zero-row rolled-back artifact:
  `21a696e4-343f-476f-b2cf-9c5b035048c8`.
- Second non-empty batch: none.
- Replay: idempotent, delta 0.
- Rollback preview: isolated, 10 removable mappings, not executed.

The zero-row artifact is not counted as an applied batch or contact.

## Read-only safety result

Before/after counts were identical for leads, persons, person source IDs,
patients, patient source IDs, staff, users, tasks, messages, notifications,
bookings, and contact mappings. The notes watermark remained
`2026-07-16T16:00:34.53+00:00`, version 4.

Production mutation detected: **false**.

## Repository boundary

Reconciliation files are limited to:

- `package.json`
- `scripts/hubspot-inventory-drift-reconciliation.ts`
- `src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server.ts`
- `src/lib/integrations/hubspot/import/hubspotContactLeadExpansionTypes.ts`
- `src/lib/integrations/hubspot/import/hubspotInventoryDriftReconciliation.ts`
- `src/lib/integrations/hubspot/import/hubspotInventoryDriftReconciliation.test.ts`
- the five 1E-D evidence files listed below

Previously audited marketing, IDE, backup, log, worktree, and other temporary
files remain unrelated and must not be staged with 1E-D.

No commit or push is permitted until explicit checksum-freeze approval.

## Verification

- Full HubSpot import suite: **118 passed, 0 failed**.
- TypeScript typecheck: **passed**.
- Production reconciliation command: **passed**.
- Canonical Snapshot A/B equality: **passed**.
- Read-only mutation guard: **passed**.
- Explicit freeze guard: **active**.

## Evidence paths

- `docs/audits/.tmp-import-1e-d-snapshot-a-expected.json`
- `docs/audits/.tmp-import-1e-d-snapshot-b-live.json`
- `docs/audits/.tmp-import-1e-d-record-delta.json`
- `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-drift-interim.json`
- `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-drift-interim.md`

## Remaining risks and approval point

- The historical v1 checksum did not bind tenant, integration, cutoff, contract
  version, or an actually populated payload checksum.
- The proposed v2 contract changes the checksum format deliberately; consumers
  must be updated only in the approved freeze step.
- Reconciliation code and evidence remain uncommitted until approval.

**Approval requested:** freeze
`1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b`
as `fi-hubspot-contact-inventory-v2`, then commit and push the isolated 1E-D
implementation and evidence. Stop before 1E-FINAL.
