# FI-EVOLVED-MUTATION-DEPTH-1 — Findings

**Milestone:** `FI-EVOLVED-MUTATION-DEPTH-1`  
**Status:** **IN PROGRESS** (MD-01 complete)  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-mutation-depth-1-plan.md](./fi-evolved-mutation-depth-1-plan.md)  
**Prior pilot:** `FI-EVOLVED-OPERATIONAL-PILOT-1` GREEN (scoped) at `a8052a2b`

---

## Executive summary

Mutation+reload depth bake started 2026-07-14. **MD-01 Consultant Pipeline stage-move + hard reload PASS** on golden SMOKETEST lead `c9a58f3d-…` (Treatment planning → Quote sent held after full reload; reverted). Help-needed: **0**. Nurse / Finance / raw-password still open.

---

## Session roster

| ID | Role | Identity | Mutation target | Status |
| -- | ---- | -------- | --------------- | ------ |
| MD-01 | Consultant | `manager@evolvedhair.com.au` (impersonation) · Consultant workspace | Pipeline stage-move + hard reload (golden SMOKETEST) | **PASS** |
| MD-02 | Nurse | TBD | Safe clinical path + hard reload | Pending |
| MD-03 | Finance | TBD | Money/invoice if safe + hard reload | Pending |
| MD-04 | Doctor | TBD | Only if safe fixture | Pending / optional SKIP |
| MD-05 | Raw password | Reception or Consultant preferred | Ordinary login (no impersonation) | Pending |

---

## Evidence log

| ID | Check | Result | Notes |
| -- | ----- | ------ | ----- |
| MD-01 | Consultant Pipeline stage-move + hard reload | **PASS** | Golden lead stage held after full reload; reverted; help-needed 0 |
| MD-02 | Nurse safe clinical + reload | Pending | — |
| MD-03 | Finance Money/invoice + reload | Pending | — |
| MD-04 | Doctor safe mutation | Pending | Optional |
| MD-05 | ≥1 raw-password login | Pending | — |
| MD-06 | No P0 | **PASS (so far)** | No identity / security / patient-record loss in MD-01 |

---

## Session MD-01 — Consultant Pipeline stage-move

**Host:** `https://follicleintelligence.ai`  
**Surface:** `/crm` Pipeline + lead detail Pipeline tab  
**Fixture:** Golden SMOKETEST lead `c9a58f3d-e1e4-4187-9986-59faed41565d` (SMOKETEST-OPDAY-20260702) · patient `287348d5-18bd-4434-9bab-7caafacbfe86`  
**Help-needed count:** **0**

| Step | Result |
| ---- | ------ |
| Session present | **PASS** — Consultant workspace; Exit impersonation; CDP shows `manager@evolvedhair.com.au` |
| Lead selected | Golden lead `c9a58f3d-e1e4-4187-9986-59faed41565d` |
| Before stage | **Treatment planning** (`22648441-dab5-4ca0-92fb-17d9f84e865d`) |
| After stage-move | **Quote sent** (`619b2f30-cc69-4506-a144-fe8b7abfd502`) via Change stage on `?tab=pipeline`; history `Treatment planning → Quote sent` · `fi_admin_lead_detail` @ `2026-07-14T03:34:14Z` |
| Hard reload | Full navigate to same lead `?tab=pipeline` |
| After reload stage | **Quote sent** still selected; history row retained |
| Revert | **Quote sent → Treatment planning** @ `2026-07-14T03:34:33Z` (non-destructive) |
| Verdict | **PASS** |

### Evidence URLs

- Board: `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/crm`
- Lead Pipeline tab (mutation + reload): `https://follicleintelligence.ai/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/crm/leads/c9a58f3d-e1e4-4187-9986-59faed41565d?tab=pipeline`

### Observe (not scored as MD-01 fail)

- Board cards for SMOKETEST did not expose **Move stage** in More (nav-only secondary on those shells); desktop drag handle absent (`FI_PIPELINE_ENABLE_DESKTOP_DRAG` / board path). Mutation exercised via lead detail **Change stage** under Pipeline tab — still Consultant Pipeline stage mutation + reload.
- Related-leads chips still labelled “Consult completed” while canonical stage is Treatment planning / Quote sent — fixture/display lag observed previously (F-PILOT-08 class); not patient-record loss.

---

## Exit checklist

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | MD-01 Consultant stage-move + reload | **PASS** |
| 2 | MD-02 Nurse safe clinical + reload | Pending |
| 3 | MD-03 Finance PASS or safe SKIP | Pending |
| 4 | MD-05 raw-password login | Pending |
| 5 | MD-06 no P0 | **PASS (so far)** |
| 6 | MD-04 Doctor PASS or SKIP | Pending |

**Overall verdict:** **IN PROGRESS** — MD-01 closed; continue MD-02 / MD-05

---

## Related

- [fi-evolved-mutation-depth-1-plan.md](./fi-evolved-mutation-depth-1-plan.md)
- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md)
