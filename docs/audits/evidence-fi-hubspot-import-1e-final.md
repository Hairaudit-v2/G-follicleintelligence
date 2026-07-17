# FI-HUBSPOT-IMPORT-1E-FINAL — Contact and lead migration closeout

**Verdict:** GREEN
**Status:** contact-and-lead migration closed
**Source cutoff:** `2026-07-16T16:00:34.530Z`
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Executive summary

FI-HUBSPOT-IMPORT-1E is complete as a controlled contact-and-lead migration.
All 4,752 unique staged HubSpot contact IDs are assigned to one mutually
exclusive primary state, with unexplained 0 and wrong-tenant 0. The migration
created 4,606 unique contact-to-lead mappings: 4,596 deterministic links to
pre-existing FI leads and 10 mappings for the only bounded new-lead creation
batch.

FI leads reconciled from 4,706 to 4,716. FI patients remained 829. No patient,
staff, user, watermark or prohibited side-effect mutation was attributed to a
contact-and-lead batch. Every mapping has a source contact ID and batch
provenance; source and target mapping identities are unique.

Deferred and reclassified records are deliberately incomplete, not migration
failures. None is approved or applied, and none is required for this closeout.

## Final source inventory

Primary states are mutually exclusive:

| Primary state | Count |
|---|---:|
| Mapped to pre-existing FI lead | 4,596 |
| Created as new FI lead and mapped | 10 |
| Deferred create candidate | 31 |
| Duplicate-risk create candidate | 1 |
| Deferred original patient-review contact | 4 |
| Retained quarantine | 67 |
| Retained exclusion | 9 |
| Reclassified but unapplied | 34 |
| Other | 0 |
| **Total** | **4,752** |

Final equation:

`4,596 + 10 + 31 + 1 + 4 + 67 + 9 + 34 + 0 = 4,752`

The patient-review total of 12 is a secondary audit view: four records have
patient review as their primary state and eight are inside the 34 reclassified
but unapplied records. The 12 must not be added to the primary equation.

The 34 1E-Q reclassifications are also a secondary review breakdown:

- 26 proposed existing-lead links, unapplied
- 8 proposed patient reviews, unapplied
- 0 proposed creates

The JSON companion lists every deferred or reclassified HubSpot contact ID and
records the shared reason, current operational state, provenance basis, review
evidence, reopening condition and no-automatic-apply control.

## Checksum closeout

| Checksum item | Value |
|---|---|
| Historical expected v1 | `fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6` |
| Historical live v1 | `b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a` |
| Frozen v2 | `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b` |
| Contract | `fi-hubspot-contact-inventory-v2` |

The v1 mismatch came from an unordered, implicit single-page active-decision
query. Persisting richer 1E-Q evidence changed which equivalent decision row was
observed for HubSpot contact `22136828309`. Only `reasonCode` changed, from
`person_source_id_single_lead` to
`existing_external_lead_or_source_id`. Source identity, classification, mapping
target and patient-review state did not change.

The v2 contract paginates decision rows, selects the latest decision
deterministically, canonicalises ordering and null/timestamp values, and includes
source payload checksum. Snapshot A equals Snapshot B under v2, and the official
inventory command reproduces the frozen checksum exactly.

## Mapping and lead reconciliation

`4,596 deterministic existing-lead links + 10 new-lead mappings = 4,606`

- unique HubSpot contact mapping sources: 4,606
- unique FI lead mapping targets: 4,606
- duplicate source mapping groups: 0
- source contacts mapped to multiple FI leads: 0
- conflicting HubSpot contact identities per FI lead: 0
- wrong-tenant mappings: 0
- mappings missing source ID: 0
- mappings missing batch provenance: 0
- applied mapping batch IDs: 13
- replay mutation delta: 0
- rollback eligibility: recorded and batch-scoped

The one new-lead batch created 10 FI persons, 10 person source IDs, 10 FI leads
and 10 external contact mappings. Production verification found all 10 lead
targets, 10 distinct people and 10 HubSpot person source identities. There was
no duplicate lead creation and no second non-empty creation batch.

FI lead reconciliation:

`4,706 before + 10 created = 4,716 after`

The zero-row batch `21a696e4-343f-476f-b2cf-9c5b035048c8` is a rolled-back
artifact with imported row count 0. It is not an applied production creation
batch.

## Patient protection

- FI patients: 829 before and 829 after
- patient creations: 0
- automatic patient links: 0
- patient demographic mutations: 0
- HubSpot patient source links created by 1E: 0
- all 12 patient-review records: unapplied

The four original 1E-P records remain deferred because email alone never
approves a patient link. The eight patient signals found in 1E-Q remain within
the reclassified, unapplied primary cohort. CRM identity and clinical identity
remain separated.

## Owner outcome

All 31 HubSpot owners reconcile:

- retained owner-to-FI-staff mappings: 2
- archived source owners: 24
- no matching FI staff: 5
- unresolved: 0
- conflicts: 0
- wrong tenant: 0
- FI staff or user records created or modified: 0

The two mapped owners are retained in `fi_staff_source_ids`. The other 29 have
explicit active owner-resolution decisions.

## Watermark outcome

The notes dataset watermark is
`2026-07-16T16:00:34.53+00:00` (version 4). Its movement belongs to scheduled
Vercel Cron notes-backup run `916c3102-548d-4758-9339-7f1e24d4d1d0`, not to a
migration apply.

The notes watermark is scoped by tenant, source system and dataset. It is not
contact coverage. The contact dataset watermark remains null; contact coverage
uses the fixed-cutoff exact-ID staging refresh. Migration batches did not advance
backup watermarks, and the refresh restored the two previously missing contacts
before the final 4,752-row freeze.

## Production batch history

| Sequence | Batch ID | Approved/applied | Operation | Mappings | Leads | Evidence commit |
|---|---|---:|---|---:|---:|---|
| 1D pilot | `46c77f5f-866d-4363-a012-b8f0c960f966` | 24/24 | link existing | 24 | 0 | `45b1b04e` |
| E1 | `544bf53d-c0fa-40c8-a67b-dcc2f26e83ea` | 100/100 | link existing | 100 | 0 | `ec4541d3` |
| E2 | `7025f783-a688-473e-8723-bc5db692998c` | 250/250 | link existing | 250 | 0 | `ec4541d3` |
| E3 | `d0b9258b-81ec-4503-a449-a39eb9371463` | 250/250 | link existing | 250 | 0 | `ec4541d3` |
| E4 | `57c26884-8d75-4e6e-98b6-aba4ab3ccf45` | 500/500 | link existing | 500 | 0 | `ec4541d3` |
| E5 | `5102a4bf-6648-4b36-9733-3b2176b4762e` | 500/500 | link existing | 500 | 0 | `ec4541d3` |
| E6 | `6cc5a10f-c4a2-411a-9b11-3ae24ec758fa` | 500/500 | link existing | 500 | 0 | `ec4541d3` |
| E7 | `5ed8a08d-70a1-4fa3-ad11-2383c79551a1` | 500/500 | link existing | 500 | 0 | `ec4541d3` |
| E8 | `a0e2bdc3-1e7b-4681-a685-5ccb6fefdfad` | 500/500 | link existing | 500 | 0 | `ec4541d3` |
| E9 | `bba7d442-d39d-4b26-a279-fba6fefe1605` | 500/500 | link existing | 500 | 0 | `74638e0e` |
| E10 | `8cf33768-ffb3-46a4-a481-4aadbb1cfd43` | 500/500 | link existing | 500 | 0 | `43ed89e3` |
| E11 | `fe956ad8-1728-4648-bb6c-85b499286a08` | 472/472 | link existing | 472 | 0 | `4fc4fcbc` |
| 1E-C first batch | `32d02f20-9852-4be2-b237-45c115f43c2b` | 10/10 | create and map | 10 | 10 | `0be78ef8` |

Every applied batch reconciled with unexplained 0, replayed with mutation delta
0, and produced a successful batch-scoped rollback preview. The full replay and
rollback counts are retained in the JSON companion and milestone evidence.

## Cumulative controls and side effects

Across all 13 non-empty contact-and-lead batches:

- reconciliation unexplained: 0
- replay mutation delta: 0
- wrong-tenant mutations: 0
- duplicate leads: 0
- duplicate mappings: 0
- patient creations or mutations: 0
- staff or user mutations: 0
- migration-owned watermark changes: 0
- rollback previews outside batch scope: 0

The mutation allowlists excluded communications, clinical, payment, booking and
integration-event tables, and every batch reconciliation reported an empty
side-effect set. Migration-owned counts are therefore 0 for outbound email,
SMS, notifications, appointments, follow-up tasks, lead sequences, patient
portal access, surgery records, payments, clinical records and outbound
integration events.

## Deferred cohort preservation

These records are intentionally incomplete:

- 31 deferred create candidates
- 1 duplicate-risk create candidate
- 4 original deferred patient-review contacts
- 26 existing-lead reclassifications, unapplied
- 8 patient-review reclassifications, unapplied

The last two groups form the 34-record 1E-Q reclassified primary cohort. The
four original plus eight reclassified patient records form the secondary
12-record patient-review view.

Each record is retained in the JSON companion by HubSpot contact ID. Source
payload checksum and timestamp are retained in the frozen v2 source snapshot,
and review evidence remains in the 1E-C, 1E-P and 1E-Q decision rows. No cohort
has an automatic apply path.

Reopening requires a separate bounded approval:

- deferred creates: repeat identity, duplicate, patient, cutoff and payload
  validation
- duplicate risk: resolve the duplicate signal first
- existing-lead reclassifications: revalidate source, tenant, target and mapping
  uniqueness
- patient reviews: obtain stronger clinical identity evidence and explicit
  clinical approval; never email-only

## Quarantine and exclusion assurance

The frozen 110-row 1E-Q cohort has explicit reasons for every record:

- retained test/smoke: 59
- retained ambiguous identity: 8
- excluded archived without business value: 9
- reclassified existing-lead link, unapplied: 26
- reclassified patient review, unapplied: 8

Test, smoke and fake identities remain non-operational. Source rows were retained
for provenance rather than deleted. Every potentially legitimate deterministic
match is visible in the 34-record secondary reclassification view; none was
silently hidden, approved or applied.

## Operational usability

Operator-facing workflows exist for owner resolution, contact migration, lead
pilot, candidate review, patient review, quarantine review, preview, immutable
approval checksum, bounded apply, reconciliation, replay, rollback preview and
audit details.

Known limitations are retained rather than overstated:

1. The requested interim approval checkpoint was missed before the first
   10-lead creation batch.
2. The first candidate-review implementation did not retain complete
   per-candidate human-readable evidence.
3. Candidate-review filters and summary counters were partial.
4. Complete screenshots and full human smoke evidence are not retained for
   every workflow.
5. The contact dataset has no incremental watermark, and the historical
   scheduler `cutoff_from` discrepancy remains incompletely explained.

These are non-blocking closeout limitations because the first batch was bounded,
all production mutations were independently reconciled, replay and rollback
controls passed, no unsafe mutation occurred, and every remaining cohort is
frozen.

## Validation

- official v2 inventory and checksum reproduction: passed
- source inventory and mutually exclusive reconciliation: passed
- mapping uniqueness, provenance and tenant checks: passed
- lead and patient count checks: passed
- owner and deferred-cohort checks: passed
- batch, replay and rollback evidence checks: passed
- side-effect and watermark ownership checks: passed
- HubSpot import tests: 120 passed, 0 failed
- quarantine and patient-protection tests: 22 passed, 0 failed
- TypeScript typecheck: passed

## Evidence index

- 1A architecture and dry run:
  `docs/audits/evidence-fi-hubspot-import-1a-architecture-and-dry-run.{md,json}`
- 1B owner mapping:
  `docs/audits/evidence-fi-hubspot-import-1b-owner-staff-mapping.{md,json}`
- 1C owner resolution:
  `docs/audits/evidence-fi-hubspot-import-1c-owner-resolution.{md,json}`
- 1D contact-to-lead pilot:
  `docs/audits/evidence-fi-hubspot-import-1d-contact-lead-pilot.{md,json}`
- 1E E1–E11:
  `docs/audits/evidence-fi-hubspot-import-1e-contact-lead-expansion.{md,json}`
- 1E-W watermark provenance:
  `docs/audits/evidence-fi-hubspot-import-1e-watermark-provenance.{md,json}`
- 1E-R staging refresh:
  `docs/audits/evidence-fi-hubspot-import-1e-contact-staging-refresh.{md,json}`
- 1E-C controlled new leads:
  `docs/audits/evidence-fi-hubspot-import-1e-controlled-new-leads.{md,json}`
- 1E-P patient review:
  `docs/audits/evidence-fi-hubspot-import-1e-p-patient-link-review.{md,json}`
- 1E-Q quarantine review:
  `docs/audits/evidence-fi-hubspot-import-1e-q-quarantine-review.{md,json}`
- 1E-D checksum freeze:
  `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-freeze.{md,json}`

## Next-gate readiness

The exact next gate is:

`FI-HUBSPOT-IMPORT-1F — Deal and pipeline-history migration pilot`

1F must begin with a bounded deal cohort, preserve existing FI lead stages,
import source pipeline history additively, prevent stage regression, suppress
CRM automation, preserve historical owner identity, retain patient-protection
boundaries, and reconcile plus replay before expansion.

Do not begin 1F until this closeout evidence is committed and present on
`origin/main`.
