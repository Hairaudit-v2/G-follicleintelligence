# FI-PH1 Task 6 — Final P0 Execution Dashboard

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Assessment date:** 2026-06-27  
**Architecture freeze:** Active  
**Engineering status:** Complete (Tasks 4–5)  
**Operator validation status:** In progress — DR screenshots + identity provisioning started 2026-06-30

**Related**

- [Production evidence registry](./production-evidence-registry.md)
- [P0 operator execution checklist](./evolved-p0-operator-execution-checklist.md)
- [Executive production decision](./evolved-production-decision.md)
- [Readiness scorecard](./readiness-scorecard.md)

---

## Dashboard summary

| Metric | Value |
|--------|-------|
| Total P0 blockers | 6 |
| Complete | 3 |
| Accepted risk | 0 |
| In progress | 1 |
| Open / blocking | 2 |
| Engineering deliverables | Complete |
| Production go-live | **Blocked** |

**Rule:** No P0 row may remain **Open** or **Blocking go-live** at deployment without executive override documented in [evolved-production-decision.md](./evolved-production-decision.md).

---

## P0 blocker register

### BLK-SEC-01 — Backup / PITR + restore drill

| Field | Value |
|-------|-------|
| **Current status** | **In progress** (E1–E3 complete; E4–E6 drill scheduled) |
| **Final production status** | **Blocking go-live** |
| **Assigned owner** | Platform / infra (To assign) |
| **Target completion date** | To verify |
| **Completion date** | — |
| **Evidence required** | PITR enabled screenshot; daily backup 7-day success; DB restore drill log (isolated staging); storage restore + signed URL test; RPO/RTO sign-off |
| **Evidence location** | [backup-disaster-recovery-audit.md](./evidence/backup-disaster-recovery-audit.md) § Evidence Closure Checklist; [production-evidence-registry.md](./production-evidence-registry.md) § Infrastructure |
| **Engineering note** | Runbooks mature; no automated PITR probe in codebase (Task 4) |
| **Next action** | Execute operator checklist §1–3; attach artifacts to `evidence/attachments/` |

---

### BLK-SEC-02 — Secret rotation + production cron evidence

| Field | Value |
|-------|-------|
| **Current status** | **Complete** |
| **Final production status** | **Allow** |
| **Assigned owner** | Paul Green (Platform Infrastructure Owner) |
| **Target completion date** | 2026-06-30 |
| **Completion date** | 2026-06-30 |
| **Evidence required** | Secret rotation log; Vercel env verification (redacted); cron 200 logs (reminder, HR, financial-os); `smoke:prod` against production; single reminder worker confirmation |
| **Evidence location** | [cron-and-secrets-audit.md](./evidence/cron-and-secrets-audit.md); `attachments/blk-sec-02-cron-probes-2026-06-30.txt`, `smoke-prod-2026-06-30.txt` |
| **Engineering note** | IIOHR bridge live; HR cron **400** empty feed (expected until staff rows in feed); reminder + FinancialOS **200** |
| **Next action** | Monitor first HR sync **200** when IIOHR feed publishes staff |

---

### BLK-LEG-01 — Legacy `/api/fi/*` production confirmation

| Field | Value |
|-------|-------|
| **Current status** | Complete |
| **Final production status** | Allow |
| **Assigned owner** | Paul Green (Security Review) |
| **Target completion date** | To verify |
| **Completion date** | — |
| **Evidence required** | Vercel screenshot: `FI_LEGACY_FI_API_ENABLED=false` or unset; Evolved ops sign-off (no prod caller needs `/api/fi/events`); product owner sign-off (HLI/HairAudit deferred) |
| **Evidence location** | [legacy-api-decision.md](./evidence/legacy-api-decision.md); [production-evidence-registry.md](./production-evidence-registry.md) § Security |
| **Engineering note** | **GO decision:** keep legacy machine API **OFF** (Task 4). Portal routes unaffected. |
| **Next action** | Capture Vercel env screenshot; complete sign-off table in legacy decision doc |

---

### BLK-FIN-01 — Financial manual-payment safety (staff acknowledgement)

| Field | Value |
|-------|-------|
| **Current status** | **Open** |
| **Final production status** | **Blocking go-live** |
| **Assigned owner** | Paul Green + Evolved Financial Operations |
| **Target completion date** | To verify |
| **Completion date** | — |
| **Evidence required** | Signed [financial clearance SOP](./evolved-financial-clearance-sop.md) §6; staff training ack (manual records ≠ Stripe proof) |
| **Evidence location** | [financial-safety-audit.md](./evidence/financial-safety-audit.md); [production-evidence-registry.md](./production-evidence-registry.md) § Financial |
| **Engineering note** | SOP authored Task 5; no code change required |
| **Next action** | Conduct staff briefing; collect signed acknowledgements |

---

### BLK-FIN-02 — Surgery deposit clearance (operational sign-off)

| Field | Value |
|-------|-------|
| **Current status** | **Open** (guard implemented; SOP sign-off pending) |
| **Final production status** | **Blocking go-live** |
| **Assigned owner** | Paul Green + Clinical Operations Lead |
| **Target completion date** | To verify |
| **Completion date** | — |
| **Evidence required** | Procedure-day checklist assigned; guard verified in staging (`not_ready` + within 14d blocks confirm); finance admin dual-truth acknowledgement |
| **Evidence location** | [financial-safety-audit.md](./evidence/financial-safety-audit.md) § Task 5 guard; [production-evidence-registry.md](./production-evidence-registry.md) § Financial |
| **Engineering note** | `updateBooking` guard implemented Task 5; does not block untracked payments — SOP still required |
| **Next action** | Staging test of guard; sign SOP §5–§6 |

---

### BLK-SEC-05 — Real Evolved staff provisioning + identity smoke

| Field | Value |
|-------|-------|
| **Current status** | **Complete** (E2+E5+E6, 2026-06-30) |
| **Final production status** | **Allow** |
| **Assigned owner** | Paul Green (Clinic Deployment Lead) |
| **Target completion date** | To verify |
| **Completion date** | — |
| **Evidence required** | ≥2 real operators with Auth + `fi_users.auth_user_id`; payroll import or IIOHR cron verified; authenticated smoketest journey; cross-tenant denial test |
| **Evidence location** | [evolved-identity-audit.md](./evidence/evolved-identity-audit.md); [production-evidence-registry.md](./production-evidence-registry.md) § Identity |
| **Engineering note** | Provisioning scripts idempotent (Task 4); seed users are not real staff |
| **Next action** | Execute operator checklist §7–8; run [smoketest journey](./evolved-smoketest-journey.md) |

---

## Execution timeline (operator)

| Phase | Blockers | Status | Owner |
|-------|----------|--------|-------|
| 1 — Infrastructure & DR | BLK-SEC-01 | Open | Paul Green |
| 2 — Secrets & cron | BLK-SEC-02 | Complete | Paul Green |
| 3 — Identity | BLK-SEC-05 | Open | Paul Green |
| 4 — Legacy API env | BLK-LEG-01 | Open | Paul Green |
| 5 — Financial SOP | BLK-FIN-01, BLK-FIN-02 | Open | Paul Green |
| 6 — Smoketest closure | All | Not started | Paul Green |
---

## Status legend

| Status | Definition |
|--------|------------|
| **Open** | No operator evidence attached |
| **In progress** | Owner assigned; evidence collection underway |
| **Complete** | All required evidence verified and dated |
| **Accepted risk** | Executive + clinic lead sign-off with named mitigation and review date |
| **Blocking go-live** | Must resolve or accept risk before deployment |

---

## Task 6 closure record

| Field | Value |
|-------|-------|
| Dashboard created | 2026-06-27 |
| Operator execution | **Not executed** — requires Supabase/Vercel dashboard access and real staff |
| P0 blockers closed | **3 / 6** (BLK-LEG-01, BLK-SEC-02, BLK-SEC-05) |
| Recommended next step | Assign owners; execute [evolved-p0-operator-execution-checklist.md](./evolved-p0-operator-execution-checklist.md) |
