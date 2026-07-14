# FI-PH1 — Production Readiness Scorecard

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Target score:** **95 / 100** required for production readiness sign-off  
**Status:** FI-READINESS-RESCORE-2 — **63 / 100** (prior Task 6: **48 / 100**; still below target; **NO-GO**)  
**Assessment basis:** Existing GREEN Evolved bake evidence (pilot / mutation-depth / ordinary-write / trust / CI hygiene) — **not** a new live clinic bake. See [fi-readiness-rescore-2.md](../audits/fi-readiness-rescore-2.md).

**Evidence locks (do not regress):** Consultant ordinary-write **GREEN — complete** (raw `manager@`, OW-01–05; **not** provisional/impersonation-only). MD-04 Doctor **PASS (observe)** closed (`1ba867c2`) — **not** open/SKIP.

**Related docs**

- [FI-PH1 sprint definition](./fi-ph1-production-hardening-sprint.md)
- [Evolved production checklist](./evolved-production-checklist.md)
- [System status & readiness (in-app score)](../design/20-system-status-and-readiness.md) — operational DB signal; **not** a substitute for this scorecard
- [Production hardening master checklist](../runbooks/fi-os-production-hardening-master-checklist.md)

---

## How to score

1. Complete the matching section in [Evolved production checklist](./evolved-production-checklist.md).
2. Assign each category a score from **0** to its **weight** (max points).
3. Use only documented evidence — smoke output, SQL read-only probes, checklist pass rows, runbook sign-offs.
4. Mark unknown criteria **To verify** (score 0 until verified).
5. Record **Assessed by**, **Date**, and **Environment** (production URL or staging with `NODE_ENV=production`).

**Partial credit:** Allowed at 50% increments when a category is partially operational (e.g. schema present, zero production usage).

---

## Weighted categories

| Category | Weight | Checklist section | Primary references |
|----------|-------:|-------------------|-------------------|
| CRM / LeadFlow | 15 | [LeadFlow](./evolved-production-checklist.md#leadflow) | [leadflow.md](../platform-architecture/leadflow.md) |
| Calendar | 15 | [CalendarOS](./evolved-production-checklist.md#calendaros) | [calendar-os.md](../platform-architecture/calendar-os.md) |
| Patient | 10 | [PatientOS](./evolved-production-checklist.md#patientos) | [patient-os.md](../platform-architecture/patient-os.md) |
| Consultation | 10 | [ConsultationOS](./evolved-production-checklist.md#consultationos) | [19-consultation-os-architecture.md](../design/19-consultation-os-architecture.md) |
| Surgery | 15 | [SurgeryOS](./evolved-production-checklist.md#surgeryos) | [surgery-os.md](../platform-architecture/surgery-os.md) |
| Financial | 15 | [FinancialOS](./evolved-production-checklist.md#financialos) | [financial-os.md](../platform-architecture/financial-os.md), [production readiness § commercial](../runbooks/fi-os-production-readiness.md) |
| Security | 10 | [Security](./evolved-production-checklist.md#security) | [fi-os-access-production.md](../fi-os-access-production.md), [auth audit](../runbooks/fi-os-auth-production-audit.md) |
| Performance | 5 | Derived from workflow timings | To verify — no SLA doc in repo |
| Monitoring | 5 | [Monitoring](./evolved-production-checklist.md#monitoring) | [smoke:prod](../../scripts/fi-production-smoke-test.ts), [system status](../design/20-system-status-and-readiness.md) |
| **Total** | **100** | | |

---

## Scorecard (FI-READINESS-RESCORE-2 — 2026-07-14)

**Assessed by:** FI-READINESS-RESCORE-2 (docs rescore from existing GREEN bake evidence)  
**Date:** 2026-07-14  
**Environment:** Production Evolved HTTPS evidence already collected in audits — **no new live clinic bake**  
**Tenant:** Evolved Hair Restoration (`EVOLVED_PERTH_TENANT_ID` — confirm UUID in Vercel — do not paste here)  
**Detail:** [fi-readiness-rescore-2.md](../audits/fi-readiness-rescore-2.md)

| Category | Weight | Score | Max | Notes / evidence |
|----------|-------:|------:|----:|------------------|
| CRM / LeadFlow | 15 | 12 | 15 | Pipeline mutate+reload (MD-01) + raw Consultant ordinary write GREEN (OW-01–05 / `8432111a`·`5d619625`); OW-06 Reception/Nurse impersonation PASS (`d7295b45`); MD-04 Doctor PASS observe (`1ba867c2`) |
| Calendar | 15 | 12 | 15 | Reception Calendar + FD check-in; F-PILOT-11 filter live PASS; soft-nav P2 residual |
| Patient | 10 | 7 | 10 | Patients hub across role bake; ImagingOS reachability; Finance Patients door (F-PILOT-18) |
| Consultation | 10 | 6 | 10 | Consult hub reachable; F-PILOT-08 linkage honesty still open |
| Surgery | 15 | 8 | 15 | Readiness observed; procedure day still flag-off / out of scope — **no lift** |
| Financial | 15 | 13 | 15 | Money trust GREEN; MD-03 due-date mutate+reload (`6df88546`); Stripe inbox still off |
| Security | 10 | 0 | 10 | **Open P0:** BLK-SEC-01 only (E1–E4 ✓ PITR/RPO + DB+app restore 2026-07-14; **E5–E6 Storage + master tick still open**). BLK-SEC-02 / BLK-SEC-05 / BLK-LEG-01 Complete — rubric: any open P0 = 0 (no Security lift) |
| Performance | 5 | 1 | 5 | Desktop bake usable; soft-nav lag / cold-load not staff-signed |
| Monitoring | 5 | 4 | 5 | CI hygiene + trust e2e GREEN; formal `smoke:prod` evidence still incomplete |
| **Total** | **100** | **63** | **100** | **Target: ≥ 95 — NOT MET** · decision class **NO-GO** (&lt; 85) |

### Historical — Task 6 assessment (2026-06-27) — 48 / 100

Retained for audit trail. Superseded by FI-READINESS-RESCORE-2 above.

| Category | Weight | Score | Max | Notes / evidence |
|----------|-------:|------:|----:|------------------|
| CRM / LeadFlow | 15 | 7 | 15 | Code paths + checklist documented (Tasks 4–5); smoketest step 1 not executed |
| Calendar | 15 | 10 | 15 | FI-native booking core validated in code; no production booking smoke |
| Patient | 10 | 5 | 10 | Schema/RLS documented; no production patient workflow smoke |
| Consultation | 10 | 5 | 10 | ConsultationOS paths documented; forms not production-tested |
| Surgery | 15 | 8 | 15 | Readiness board + confirmation guard unit-tested; procedure day not production-tested |
| Financial | 15 | 10 | 15 | Guard + SOP authored; BLK-FIN staff sign-off pending |
| Security | 10 | 0 | 10 | Open P0: BLK-SEC-01/02/05, BLK-LEG-01 |
| Performance | 5 | 0 | 5 | Not assessed |
| Monitoring | 5 | 3 | 5 | Local `check:env` pass; no `smoke:prod` against production URL |
| **Total** | **100** | **48** | **100** | Prior NO-GO baseline |

### Score gap analysis (32 points to target from 63)

| Gap | Points lost | Blocker / action |
|-----|------------:|------------------|
| Security (open P0) | 10 | **BLK-SEC-01** Storage restore + E6 (E4 DB+app PASS 2026-07-14) — SEC-02/05/LEG-01 already Complete |
| Surgery | 7 | Procedure day production dry-run or explicit accepted deferral |
| CRM / LeadFlow | 3 | Soft-nav / remaining checklist rows (ordinary-write + OW-06 already GREEN) |
| Calendar | 3 | Soft-nav + sync health review |
| Patient | 3 | Broader production patient workflow sign-off |
| Consultation | 4 | Completeness + linkage honesty (F-PILOT-08) |
| Financial | 2 | SOP sign-off residual |
| Performance | 4 | Staff latency sign-off |
| Monitoring | 1 | Production `smoke:prod` green close-out |

**Primary blockers preventing ≥ 95:** **BLK-SEC-01** still open on **E5 Storage restore + signed URL** and **E6** (E1–E4 evidenced) — see [backup-disaster-recovery-audit.md](./evidence/backup-disaster-recovery-audit.md) and [fi-security-restore-drill-1.md](../security/fi-security-restore-drill-1.md). Clinic bake GREEN does **not** clear DR P0.

---

## Scorecard template (historical)

**Assessed by:** To verify  
**Date:** To verify  
**Environment:** To verify  
**Tenant:** `EVOLVED_PERTH_TENANT_ID` (confirm UUID in Vercel — do not paste here)

| Category | Weight | Score | Max | Notes / evidence |
|----------|-------:|------:|----:|------------------|
| CRM / LeadFlow | 15 | To verify | 15 | |
| Calendar | 15 | To verify | 15 | |
| Patient | 10 | To verify | 10 | |
| Consultation | 10 | To verify | 10 | |
| Surgery | 15 | To verify | 15 | |
| Financial | 15 | To verify | 15 | |
| Security | 10 | To verify | 10 | |
| Performance | 5 | To verify | 5 | |
| Monitoring | 5 | To verify | 5 | |
| **Total** | **100** | **To verify** | **100** | **Target: ≥ 95** |

---

## Category rubrics

### CRM / LeadFlow (15)

| Points | Criteria |
|-------:|----------|
| 15 | Lead create/edit, pipeline stage, conversion to person/case, CRM activity events; HubSpot/import path documented or N/A with sign-off |
| 10 | Core CRM works; external ingest or scoring partial |
| 5 | Read-only or schema-only; no production usage |
| 0 | Blocked or cross-tenant risk |

### Calendar (15)

| Points | Criteria |
|-------:|----------|
| 15 | FI bookings + calendar views; Perth timezone; Google or Timely path documented; conflict/review queue understood |
| 10 | FI-native bookings operational; external sync degraded but acceptable |
| 5 | Views load; writes fail or sync untested |
| 0 | Booking workflow blocked |

### Patient (10)

| Points | Criteria |
|-------:|----------|
| 10 | Profile, clinical details, timeline, images upload; tenant RLS verified |
| 7 | Profile + partial clinical |
| 3 | Schema only |
| 0 | PHI access issue |

### Consultation (10)

| Points | Criteria |
|-------:|----------|
| 10 | Consultation record linked to booking/patient; forms usable; activity/timeline signals |
| 7 | Consult shell + partial forms |
| 3 | Design-only or untested |
| 0 | Cannot complete consult workflow |

### Surgery (15)

| Points | Criteria |
|-------:|----------|
| 15 | Case + procedure day (V1.1 team/milestones migration applied); graft/safety surfaces as used by Evolved |
| 10 | Case planning; procedure day partial |
| 5 | Read-only case list |
| 0 | Surgery day blocked |

### Financial (15)

| Points | Criteria |
|-------:|----------|
| 15 | Manual `fi_payment_records` workflow validated; deposit visibility; no false automation claims |
| 10 | Payment records + quotes; AR/financing untested |
| 5 | Read-only financial views |
| 0 | Data integrity or auth issue on financial writes |

**Note:** Integrated Stripe/card capture is **not** scored as required for FI-PH1 per [production readiness](../runbooks/fi-os-production-readiness.md).

### Security (10)

| Points | Criteria |
|-------:|----------|
| 10 | Production gates (`NODE_ENV=production`), session tenant portal API, no query-string admin keys, cron/webhook secrets, RLS spot-check |
| 7 | One documented accepted risk |
| 3 | Staging-only validation |
| 0 | Known bypass or open P0 |

### Performance (5)

| Points | Criteria |
|-------:|----------|
| 5 | Key routes acceptable under normal load (calendar, patient profile, reception board) — subjective staff sign-off |
| 3 | Occasional slow loads; workaround exists |
| 0 | Unusable latency |

**To verify:** Define acceptable thresholds with Evolved ops (no repo SLA).

### Monitoring (5)

| Points | Criteria |
|-------:|----------|
| 5 | `smoke:prod` green; system status page loads; HR sync health if cron enabled; alert path documented |
| 3 | Smoke partial; manual monitoring only |
| 0 | No smoke; failures undetected |

---

## Go / no-go

| Total | Decision |
|------:|----------|
| **≥ 95** | **Go** — Evolved production operational (FI-PH1 complete) |
| 85–94 | **Conditional** — named gaps + dated remediation before marketing "production" |
| < 85 | **No-go** — continue FI-PH1 validation |

---

## Sign-off

| Role | Name | Date | Signature / ticket |
|------|------|------|-------------------|
| Engineering | To verify | | |
| Evolved operations | To verify | | |
| Platform owner | To verify | | |
