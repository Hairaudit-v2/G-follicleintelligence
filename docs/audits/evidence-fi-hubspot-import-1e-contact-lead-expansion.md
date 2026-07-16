# FI-HUBSPOT-IMPORT-1E — Controlled contact and lead migration expansion evidence

**Verdict:** AMBER — E1–E8 GREEN; expansion paused for E9 approval

**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Closeout (cumulative)

**FI-HUBSPOT-IMPORT-1E Batches E1–E8: GREEN**

Eight consecutive reconciled production expansion batches completed with the
patient-protection gate held. Further batches (E9) require operator approval.

### Post-E8 inventory (write-free)

| Metric | Value |
|--------|------:|
| Total source contacts | 4,750 |
| Already linked / applied | 3,124 |
| Ready to link | 1,472 |
| Proposed new leads | 46 |
| Patient review | 4 |
| Quarantined | 104 |
| Conflicts | 0 |
| Wrong-tenant | 0 |
| Migration completion | 68% |

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

### Batch E8 production outcome

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
`a0e2bdc3-1e7b-4681-a685-5ccb6fefdfad`

Checksum:
`e54ab584f5000c99eb5aa912d8567ffaed58961cd1895d380125ebf55a11f6c8`

Identity method:
`person_source_id_single_lead` (all 500)

Prior batch gate:
- priorBatchId `5ed8a08d-70a1-4fa3-ad11-2383c79551a1` (E7) reconciled, unexplained 0

Approved scope enforced:
- link_existing_lead only (expanded 500-contact batch)
- no create_new_lead, patient-review, test/smoke, or quarantine records in batch
- 46 create candidates and 4 patient-review records excluded

### Cumulative counts (after E8)

| Entity | Before 1E | After E8 |
|--------|----------:|---------:|
| `fi_crm_leads` | 4706 | 4706 |
| `fi_patients` | 829 | 829 |
| contact→lead external mappings | 24 | 3124 |

Expansion-only mappings created: **3100** (E1–E8)

### E8 controls verified

- E7 reconciliation gate passed before E8 apply
- batch size exactly 500
- immutable preview checksum; zero proposed lead creations
- additive mappings only; mapping delta +500
- reconciliation: unexplained 0, balanced
- replay: already_applied ×500, mutation delta 0
- rollback preview isolates exactly 500 E8 mappings; zero blocked
- patient count unchanged; zero side effects
- HubSpot backup watermark unchanged (`2026-07-16T03:45:02.366+00:00`)

### Exact next step

**Approve Batch E9** (up to 500 contacts, link_existing_lead only) after reviewing E8 evidence.

Programme next gate after full 1E closeout:
**FI-HUBSPOT-IMPORT-1F — Deal and pipeline-history migration pilot**

## Artifacts

- `docs/audits/.tmp-import-1e-e8-select.json`
- `docs/audits/.tmp-import-1e-e8-preview.json`
- `docs/audits/.tmp-import-1e-e8-apply.json`
- `docs/audits/.tmp-import-1e-e8-reconcile.json`
- `docs/audits/.tmp-import-1e-e8-replay.json`
- `docs/audits/.tmp-import-1e-e8-rollback-preview.json`
- `docs/audits/.tmp-import-1e-e8-gate.json`
- `docs/audits/.tmp-import-1e-post-e8-inventory.json`
- `docs/audits/evidence-fi-hubspot-import-1e-contact-lead-expansion.json`

## Workspace

`/fi-admin/[tenantId]/settings/integrations/hubspot?tab=contact-migration`
