# FI-HUBSPOT-IMPORT-1E-D — Inventory checksum freeze

**Verdict:** GREEN  
**Status:** `FREEZE_APPROVED`  
**Date:** 2026-07-17  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`  
**Source cutoff:** `2026-07-16T16:00:34.530Z`

## Freeze decision

| Item                          | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Original expected v1 checksum | `fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6` |
| Prior live v1 checksum        | `b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a` |
| Newly frozen v2 checksum      | `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b` |
| Contract version              | `fi-hubspot-contact-inventory-v2`                                  |
| Replacement frozen            | **Yes**                                                            |
| Explicit approval             | **Approved**                                                       |

Historical v1 checksums remain preserved in:

- `HUBSPOT_QUARANTINE_ORIGINAL_EXPECTED_V1_INVENTORY_CHECKSUM`
- `HUBSPOT_QUARANTINE_PRIOR_LIVE_V1_INVENTORY_CHECKSUM`
- interim reconciliation evidence

They were not overwritten or deleted.

## Root cause

The v1 inventory checksum depended on an unordered, single-page decision query.
Persisting 1E-Q review evidence changed which active decision rows appeared on
that capped page. HubSpot contact `22136828309` therefore fell back from its
saved reason code `person_source_id_single_lead` to the equivalent derived
reason code `existing_external_lead_or_source_id`.

Authoritative migration state remained `already_applied` and the FI lead target
remained `dc3fe85f-1f69-4c51-b3b5-b811e08e1821`.

## Field-level delta

| Field                         | Old                                    | New                                   |
| ----------------------------- | -------------------------------------- | ------------------------------------- |
| HubSpot contact ID            | `22136828309`                          | unchanged                             |
| Primary classification        | `already_applied`                      | unchanged                             |
| Reason code                   | `person_source_id_single_lead`         | `existing_external_lead_or_source_id` |
| FI lead target                | `dc3fe85f-1f69-4c51-b3b5-b811e08e1821` | unchanged                             |
| Source timestamp              | `2026-02-11T06:17:57.524Z`             | unchanged                             |
| Patient warning               | none                                   | none                                  |
| Quarantine / exclusion reason | none                                   | none                                  |

Under the frozen v2 contract:

- Snapshot A checksum equals Snapshot B checksum
- added contact IDs: none
- removed contact IDs: none
- classification-change count: 0
- mapping-target-change count: 0
- patient-review-change count: 0
- unexplained count: 0
- wrong-tenant count: 0

## Source and cohort position

- Source contacts: 4,752 unique
- Duplicate source IDs: 0
- Staging updated after expected snapshot: 0
- Cross-tenant staging rows: 0
- Mapped: 4,606
- Deferred create candidates: 31
- Duplicate-risk create: 1
- Original patient review: 4
- Retained test/smoke: 59
- Retained ambiguous: 8
- Excluded archived: 9
- Deferred existing-lead reclassifications: 26
- Deferred patient-review reclassifications: 8
- Programme primary total: 4,752

## Production safety

- FI leads: 4,716
- FI patients: 829
- Contact-to-lead mappings: 4,606
- HubSpot patient source links: 0
- Production mutation during reconciliation: false
- 1E-C completed non-empty batches: 1
- 1E-C created rows: 10
- Zero-row rolled-back artifact retained and not counted as apply

## Official inventory verification

Official command:

`node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/hubspot-quarantine-review.ts --inventory --output-json docs/audits/.tmp-import-1e-d-official-inventory-v2.json`

Result:

| Check                         | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Recomputed inventory checksum | `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b` |
| Matches frozen checksum       | **Yes**                                                            |
| Contract version              | `fi-hubspot-contact-inventory-v2`                                  |
| Unexplained                   | 0                                                                  |
| Wrong tenant                  | 0                                                                  |
| Source total                  | 4,752                                                              |
| FI leads                      | 4,716                                                              |
| FI patients                   | 829                                                                |
| Contact-to-lead mappings      | 4,606                                                              |

Verification suite:

- HubSpot import tests: 120 passed
- Quarantine review tests: 12 passed
- TypeScript typecheck: passed

## Evidence paths

- `docs/audits/.tmp-import-1e-d-snapshot-a-expected.json`
- `docs/audits/.tmp-import-1e-d-snapshot-b-live.json`
- `docs/audits/.tmp-import-1e-d-record-delta.json`
- `docs/audits/.tmp-import-1e-d-official-inventory-v2.json`
- `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-drift-interim.json`
- `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-drift-interim.md`
- `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-freeze.json`
- `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-freeze.md`

## Exact next gate

`FI-HUBSPOT-IMPORT-1E-FINAL` — Contact and lead migration closeout

Do not begin `FI-HUBSPOT-IMPORT-1F` until 1E-FINAL is complete.
