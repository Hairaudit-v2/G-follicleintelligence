# FI-HUBSPOT-IMPORT-1E — Controlled contact and lead migration expansion evidence

**Verdict:** AMBER — E1–E11 link-only batches GREEN; 1E-W watermark provenance AMBER; non-link cohorts remain excluded

**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Closeout (cumulative)

**FI-HUBSPOT-IMPORT-1E Batches E1–E11: GREEN**

Eleven consecutive reconciled production expansion batches completed with the
patient-protection gate held. E11 completed the deterministic link-only population.

E10 audit commit `43ed89e3` was on `origin/main` before E11 apply.

### Post-E11 inventory (write-free)

| Metric | Value |
|--------|------:|
| Total source contacts | 4,750 |
| Already linked / applied | 4,596 |
| Ready to link | 0 |
| Proposed new leads | 46 |
| Patient review | 4 |
| Quarantined | 104 |
| Conflicts | 0 |
| Wrong-tenant | 0 |
| Migration completion | 99% |

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
| E11 | 472 | 472 | 0 | unexplained 0 | already_applied ×472 | 472 mappings |

### Batch E11 production outcome

| Metric | Value |
|--------|------:|
| Batch size | 472 |
| Existing leads linked | 472 |
| New leads created | 0 |
| Already applied (pre-apply) | 0 |
| Creates in preview | 0 |
| Conflicts | 0 |
| Wrong-tenant | 0 |

Production batch:
`fe956ad8-1728-4648-bb6c-85b499286a08`

Checksum:
`44021eb7759318f98b1b5ea32a425f1fea70836250f780e79b5b9f3cf5e26a10`

Identity method:
`person_source_id_single_lead` (all 472)

Prior batch gate:
- priorBatchId `8cf33768-ffb3-46a4-a481-4aadbb1cfd43` (E10) reconciled, unexplained 0
- E10 audit commit `43ed89e3` confirmed on origin/main before apply

Approved scope enforced:
- link_existing_lead only (final 472-contact deterministic cohort)
- no create_new_lead, patient-review, test/smoke, or quarantine records in batch
- 46 create candidates and 4 patient-review records excluded

### Cumulative counts (after E11)

| Entity | Before 1E | After E11 |
|--------|----------:|----------:|
| `fi_crm_leads` | 4706 | 4706 |
| `fi_patients` | 829 | 829 |
| contact→lead external mappings | 24 | 4596 |

Expansion-only mappings created: **4572** (E1–E11)

### E11 controls verified

- E10 reconciliation gate passed before E11 apply
- E10 audit commit pushed before E11 apply
- batch size exactly 472, matching the refreshed ready-to-link population
- immutable preview checksum; zero proposed lead creations
- additive mappings only; mapping delta +472
- reconciliation: unexplained 0, balanced
- replay: already_applied ×472, mutation delta 0
- rollback preview isolates exactly 472 E11 mappings; zero blocked
- patient count unchanged; zero side effects
- apply-time watermark unchanged (`2026-07-16T16:00:34.53+00:00`)
- checkpoint exception: watermark advanced from E10's
  `2026-07-16T03:45:02.366+00:00` before E11 selection; no E11 mutation caused it

### 1E-W watermark provenance (2026-07-16)

| Field | Value |
|-------|-------|
| Verdict | AMBER |
| Owning run | `916c3102-548d-4758-9339-7f1e24d4d1d0` |
| Trigger | Vercel Cron notes incremental (`empty_success`) |
| Previous watermark | `2026-07-16T03:45:02.366+00:00` |
| Current watermark | `2026-07-16T16:00:34.53+00:00` |
| Recommendation | `retain_current_watermark` |
| Migration ownership | none |
| Live contacts created in interval | 1 |
| Live contacts modified in interval | 21 |
| Missing from staging inventory | 2 (`229761370222`, `235542182239`) |

Full evidence:
`docs/audits/evidence-fi-hubspot-import-1e-watermark-provenance.md`

### Exact next step

**Stop link-only expansion.** Ready-to-link is zero. Do not process the 46
create candidates, 4 patient-review records, or 104 quarantined records without
separate approval.

Before **FI-HUBSPOT-IMPORT-1E-C**, refresh/reconcile HubSpot contact staging for
the two live contacts absent from the 4,750 staging inventory (and review the
21-interval modified set). Notes watermark retention is approved; notes watermark
must not be treated as contact coverage.

Programme next gate after create/review closeout:
**FI-HUBSPOT-IMPORT-1F — Deal and pipeline-history migration pilot**

## Artifacts

- `docs/audits/.tmp-import-1e-e11-select.json`
- `docs/audits/.tmp-import-1e-e11-preview.json`
- `docs/audits/.tmp-import-1e-e11-apply.json`
- `docs/audits/.tmp-import-1e-e11-reconcile.json`
- `docs/audits/.tmp-import-1e-e11-replay.json`
- `docs/audits/.tmp-import-1e-e11-rollback-preview.json`
- `docs/audits/.tmp-import-1e-e11-gate.json`
- `docs/audits/.tmp-import-1e-post-e11-inventory.json`
- `docs/audits/evidence-fi-hubspot-import-1e-contact-lead-expansion.json`

## Workspace

`/fi-admin/[tenantId]/settings/integrations/hubspot?tab=contact-migration`
