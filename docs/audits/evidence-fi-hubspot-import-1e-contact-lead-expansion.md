# FI-HUBSPOT-IMPORT-1E — Controlled contact and lead migration expansion evidence

**Verdict:** AMBER — E1–E10 GREEN; expansion paused for E11 approval

**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Closeout (cumulative)

**FI-HUBSPOT-IMPORT-1E Batches E1–E10: GREEN**

Ten consecutive reconciled production expansion batches completed with the
patient-protection gate held. Further batches (E11) require operator approval.

E9 audit commit `74638e0e` was on `origin/main` before E10 apply.

### Post-E10 inventory (write-free)

| Metric | Value |
|--------|------:|
| Total source contacts | 4,750 |
| Already linked / applied | 4,124 |
| Ready to link | 472 |
| Proposed new leads | 46 |
| Patient review | 4 |
| Quarantined | 104 |
| Conflicts | 0 |
| Wrong-tenant | 0 |
| Migration completion | 89.1% |

### Batch history

| Batch | Size | Linked | Creates | Reconcile | Replay | Rollback |
|-------|-----:|-------:|--------:|-----------|--------|----------|
| E1 | 100 | 100 | 0 | unexplained 0 | already_applied ×100 | 100 mappings |
| E2 | 250 | 250 | 0 | unexplained 0 | already_applied ×250 | 250 mappings |
| E3 | 250 | 250 | 0 | unexplained 0 | already_applied ×250 | 250 mappings |
| E4 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |
| E5 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |
| E6 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |
| E7 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |
| E8 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |
| E9 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |
| E10 | 500 | 500 | 0 | unexplained 0 | already_applied ×500 | 500 mappings |

### Batch E10 production outcome

| Metric | Value |
|--------|------:|
| Batch size | 500 |
| Existing leads linked | 500 |
| New leads created | 0 |
| Already applied (pre-apply) | 0 |
| Creates in preview | 0 |
| Conflicts | 0 |
| Wrong-tenant | 0 |

Production batch:
`8cf33768-ffb3-46a4-a481-4aadbb1cfd43`

Checksum:
`e66922f6d935c51cc490ee63c01da7294f0f711540b4560a40a54aa7d6d965c9`

Identity method:
`person_source_id_single_lead` (all 500)

Prior batch gate:
- priorBatchId `bba7d442-d39d-4b26-a279-fba6fefe1605` (E9) reconciled, unexplained 0
- E9 audit commit `74638e0e` confirmed on origin/main before apply

Approved scope enforced:
- link_existing_lead only (expanded 500-contact batch)
- no create_new_lead, patient-review, test/smoke, or quarantine records in batch
- 46 create candidates and 4 patient-review records excluded

### Cumulative counts (after E10)

| Entity | Before 1E | After E10 |
|--------|----------:|----------:|
| `fi_crm_leads` | 4706 | 4706 |
| `fi_patients` | 829 | 829 |
| contact→lead external mappings | 24 | 4124 |

Expansion-only mappings created: **4100** (E1–E10)

### E10 controls verified

- E9 reconciliation gate passed before E10 apply
- E9 audit commit pushed before E10 apply
- batch size exactly 500
- immutable preview checksum; zero proposed lead creations
- additive mappings only; mapping delta +500
- reconciliation: unexplained 0, balanced
- replay: already_applied ×500, mutation delta 0
- rollback preview isolates exactly 500 E10 mappings; zero blocked
- patient count unchanged; zero side effects
- HubSpot backup watermark unchanged (`2026-07-16T03:45:02.366+00:00`)

### Exact next step

**Approve Batch E11** (up to 500 contacts, link_existing_lead only) after reviewing E10 evidence.
Remaining ready-to-link population is 472, so E11 may be a smaller final link-only batch.

Programme next gate after full 1E closeout:
**FI-HUBSPOT-IMPORT-1F — Deal and pipeline-history migration pilot**

## Artifacts

- `docs/audits/.tmp-import-1e-e10-select.json`
- `docs/audits/.tmp-import-1e-e10-preview.json`
- `docs/audits/.tmp-import-1e-e10-apply.json`
- `docs/audits/.tmp-import-1e-e10-reconcile.json`
- `docs/audits/.tmp-import-1e-e10-replay.json`
- `docs/audits/.tmp-import-1e-e10-rollback-preview.json`
- `docs/audits/.tmp-import-1e-e10-gate.json`
- `docs/audits/.tmp-import-1e-post-e10-inventory.json`
- `docs/audits/evidence-fi-hubspot-import-1e-contact-lead-expansion.json`

## Workspace

`/fi-admin/[tenantId]/settings/integrations/hubspot?tab=contact-migration`
