# FI-HUBSPOT-IMPORT-1E-R — Contact staging refresh and interval reconciliation

**Verdict:** GREEN  
**Date:** 2026-07-17  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`  
**HubSpot portal:** configured `21009770`; live `21009770`; match  
**Code commit:** `725a0a0f`

## Outcome

The two missing live contacts were created after the completed contact staging
snapshot of 2026-07-15 and were therefore absent for a normal, explained source
freshness reason. The approved contact backup normalization/upsert path refreshed
the exact 21-contact interval cohort and added the two missing rows. No FI entity,
external mapping, dataset watermark, notification, task, or appointment changed.

The corrected post-refresh inventory is:

`4,596 mapped + 42 create candidates + 4 patient review + 100 quarantined + 10 excluded = 4,752`

Unexplained: **0**  
Inventory checksum:
`3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c`

The create-candidate count for 1E-C is **42**, not 46 or 48.

## Fixed source boundary and provenance

- Contact cutoff: `[2026-07-16T03:45:02.366Z, 2026-07-16T16:00:34.530Z)`
- Approved 21-contact payload checksum:
  `8f6030f5111e1dbf58d535010c8933513d3a6b8e6cdbc1c781e34512ee0407b5`
- Original full staging run:
  `fcfb9587-1b0a-4194-9104-86d5ba45e578`
  (`2026-07-15T03:26:11.342Z` to `2026-07-15T03:28:41.149Z`)
- Contact-only refresh run:
  `bad4e6d0-8ff3-4e72-bff8-4709f6799b93`
- Idempotency replay run:
  `74bde1bd-9ac3-4e98-9668-ac3421419a7c`
- Initial refresh: 21 staged; 19 existing; 2 added; 0 skipped; 0 failed.
- Replay: 21 staged; 21 existing; 0 added; inventory unchanged.

The refresh reused the normal contact staging normalization, payload checksum,
association staging, and tenant/integration/source-ID upsert conflict key. It did
not manually insert contact rows and did not invoke migration apply.

## Missing contact outcomes

### `229761370222`

- Created: `2026-07-16T04:15:52.321Z`
- Modified: `2026-07-16T11:33:03.155Z`
- Archived: no
- Owner: unset
- Lifecycle / lead status: `lead` / `UNQUALIFIED`
- Name, email, phone quality: present / present / present
- Staging: absent → present
- Existing person source ID: none
- Existing external mapping: none
- Unique FI lead candidate: none
- Possible patient overlap: none
- Classification: `create_new_lead`
- Reason: `no_deterministic_match_propose_new_lead`
- Prior omission: created after the 2026-07-15 staging snapshot

### `235542182239`

- Created: `2026-07-16T03:21:41.141Z`
- Modified: `2026-07-16T12:06:50.956Z`
- Archived: no
- Owner: unset
- Lifecycle / lead status: `lead` / `OPEN_DEAL`
- Name, email, phone quality: present / present / present
- Staging: absent → present
- Existing person source ID: none
- Existing external mapping: none
- Unique FI lead candidate: none
- Possible patient overlap: none
- Classification: `create_new_lead`
- Reason: `no_deterministic_match_propose_new_lead`
- Prior omission: created after the 2026-07-15 staging snapshot

Neither decision authorizes lead creation. Both records are only candidates for
the separately controlled 1E-C gate.

## 21-contact identity revalidation

Every row retained the same source ID and tenant. All 11 mapped rows retained
their unique FI lead target. No duplicate target, patient warning, wrong-tenant
candidate, mapping overwrite, or unexplained decision change appeared.

| HubSpot contact | Post-refresh decision | Target result | Guard result |
|---|---|---|---|
| `212912271714` | mapped | `9a4bab70-3927-4bf5-b2e9-86a5205717d9` unchanged | safe |
| `215710882163` | mapped | `7e2351d2-cabe-414d-8ead-20a523044fc1` unchanged | safe |
| `217987713131` | mapped | `8b6dccd7-1398-4868-9816-84170a2fc243` unchanged | safe |
| `219927242862` | mapped | `f3ee8817-bba1-4845-8693-1cf3a45ff425` unchanged | safe |
| `226778812230` | mapped | `d062bad0-f484-4b47-8725-e5fc85343dd3` unchanged | safe |
| `226836338736` | mapped | `9e39b987-abf4-4945-a208-d28fc18df80c` unchanged | safe |
| `226877437753` | mapped | `ee14b1b4-254a-4cdf-830c-20923c22569d` unchanged | safe |
| `226998940750` | mapped | `c9a5ee76-bf3e-43f1-8a80-438dfdb30ea9` unchanged | safe |
| `227450310196` | mapped | `84b9df54-88a7-4289-b04c-b49c7251b548` unchanged | safe |
| `227468262147` | mapped | `3c0e0f33-e5ba-4bd3-af5f-2980a2a6086d` unchanged | safe |
| `227930895245` | create candidate | no target | safe; unchanged |
| `228399343189` | create candidate | no target | safe; unchanged |
| `229037454111` | create candidate | no target | safe; unchanged |
| `229761370222` | create candidate | no target | safe; newly classified |
| `230639040339` | create candidate | no target | safe; unchanged |
| `231956151096` | quarantined | no target | safe; ambiguity retained |
| `233915878521` | quarantined | no target | safe; ambiguity retained |
| `234237072023` | create candidate | no target | safe; unchanged |
| `234773951030` | create candidate | no target | safe; unchanged |
| `235542182239` | create candidate | no target | safe; newly classified |
| `82416974089` | mapped | `86a29e32-041a-4576-8461-eb96f8bfe334` unchanged | safe |

Reviewed-cohort totals: 11 mapped, 8 create candidates, 0 patient review,
2 quarantined, 0 excluded.

## Inventory classification correction

The staging table contains 10 archived contacts, but the prior inventory mapper
did not select the staging `archived` column and therefore reported excluded 0.
The mapper now honors the staged archived state. This conservative correction:

- moved 6 prior create candidates to excluded;
- moved 4 prior quarantined contacts to excluded;
- added the 2 newly staged contacts as create candidates.

Therefore the create-candidate count changed from 46 to 42 and quarantine from
104 to 100. Mapped and patient-review counts remained 4,596 and 4.

## Mutation and watermark reconciliation

| State | Before | After |
|---|---:|---:|
| Contact staging rows | 4,750 | 4,752 |
| FI leads | 4,706 | 4,706 |
| Patients | 829 | 829 |
| Staff | 22 | 22 |
| Users | 20 | 20 |
| Contact→lead mappings | 4,596 | 4,596 |
| Contact watermark | absent | absent |
| Notes watermark | `2026-07-16T16:00:34.530Z` | `2026-07-16T16:00:34.530Z` |

The contact refresh was represented as a contacts dataset sync run with the
fixed cutoff in durable run provenance. It intentionally did not create or
advance a contacts watermark because this was an exact-ID recovery, not proof
of a complete incremental contact scan. The notes watermark was not read as a
contact cursor and did not change.

Patient mutations: 0. FI lead mutations: 0. Mapping mutations: 0.
Wrong-tenant results: 0. Side effects: 0.

## Verification

- TypeScript `--noEmit`: passed.
- Focused contact refresh, staging, coverage, identity, patient, tenant, mapping,
  archived-state, and watermark-isolation tests: 63 passed; 0 failed.
- Production idempotency replay: passed; staging remained 4,752 and checksum
  remained stable.
- Coverage assertion: balanced; unexplained 0.

Temporary operator artifacts (not committed because they contain source payloads):

- `docs/audits/.tmp-import-1e-r-preview.json`
- `docs/audits/.tmp-import-1e-r-apply.json`
- `docs/audits/.tmp-import-1e-r-retry.json`
- `docs/audits/.tmp-import-1e-r-inventory.json`

Structured, privacy-safe evidence:
`docs/audits/evidence-fi-hubspot-import-1e-contact-staging-refresh.json`

## Remaining risks and next gate

- There is no complete contacts incremental watermark. This exact-ID refresh
  conservatively retained contacts watermark `null`.
- The 42 create candidates remain unapproved and unprocessed.
- Four patient-review and 100 quarantined contacts remain excluded from apply.

Exact next gate:
**FI-HUBSPOT-IMPORT-1E-C — Controlled new-lead candidate review**

The gate must use the refreshed count of **42**.
