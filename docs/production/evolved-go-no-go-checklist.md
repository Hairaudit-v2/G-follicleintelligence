# Evolved Hair Restoration — Go / No-Go Checklist

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Purpose:** Executive decision gate for Evolved production go-live  
**Decision options:** **GO** · **GO WITH MITIGATION** · **NO-GO**  
**Last updated:** To verify

**Related docs**

- [P0/P1 remediation command centre](./fi-ph1-p0-p1-remediation-command-centre.md)
- [Go-live risk register](./evolved-go-live-risk-register.md)
- [Smoketest journey](./evolved-smoketest-journey.md)
- [Readiness scorecard](./readiness-scorecard.md)
- [Production release checklist](../runbooks/fi-os-production-release-checklist.md)

**Instructions:** Mark each gate **Pass**, **Fail**, **Accepted risk**, or **To verify**. Do not mark Pass without evidence reference. Any **Fail** in Critical safety gates defaults to **NO-GO** unless executive override is documented.

---

## Decision summary

| Field | Value |
|-------|-------|
| **Assessment date** | To verify |
| **Environment URL** | To verify |
| **Assessed by** | To verify |
| **Executive sponsor** | To verify |
| **Readiness score** | To verify / 100 (target ≥ 95) |
| **Final decision** | ☐ GO · ☐ GO WITH MITIGATION · ☐ NO-GO |
| **Decision rationale** | To verify |

---

## Critical safety gates

*Any Fail → default **NO-GO** unless dated executive **Accepted risk** attached.*

| # | Gate | Blocker ref | Status | Evidence ref |
|---|------|-------------|--------|--------------|
| C1 | Backup / PITR enabled and storage restore drill completed | BLK-SEC-01 | To verify | |
| C2 | Secrets rotated; Vercel cron verified (reminders + IIOHR) | BLK-SEC-02 | To verify | |
| C3 | Real Evolved staff provisioned; `smoke:prod` passes | BLK-SEC-05 | To verify | |
| C4 | Legacy `/api/fi/*` go/no-go decision recorded | BLK-LEG-01 | To verify | |
| C5 | No open P0 cross-tenant or auth bypass incidents | BLK-SEC-03 | To verify | |
| C6 | `NODE_ENV=production` gates verified; no insecure API bypass | [fi-os-access-production](../fi-os-access-production.md) | To verify | |

**Section outcome:** ☐ Pass · ☐ Fail · ☐ Accepted risk

---

## Operational workflow gates

| # | Gate | Blocker ref | Status | Evidence ref |
|---|------|-------------|--------|--------------|
| O1 | FI-native booking SOP adopted; Google staging review-only | BLK-CAL-01 | To verify | |
| O2 | Calendar sync health review process assigned (weekly) | BLK-CAL-02 | To verify | |
| O3 | Lead → consult → patient → surgery path smoketest complete | [Smoketest journey](./evolved-smoketest-journey.md) | To verify | |
| O4 | Parallel lead model (`fi_crm_leads` vs `fi_leads`) confirmed for Evolved | BLK-X-03 | To verify | |
| O5 | HubSpot inbound confirmed N/A or import-only for Evolved | BLK-X-01 | To verify | |
| O6 | Timely integration posture confirmed (N/A or secret-gated) | BLK-CAL-03 | To verify | |

**Section outcome:** ☐ Pass · ☐ Fail · ☐ Accepted risk

---

## Financial gates

| # | Gate | Blocker ref | Status | Evidence ref |
|---|------|-------------|--------|--------------|
| F1 | Staff trained: `fi_payment_records` = manual tracking only | BLK-FIN-01 | To verify | |
| F2 | Manual deposit clearance SOP signed before surgery booking | BLK-FIN-02 | To verify | |
| F3 | Stripe disabled or webhook idempotency verified | BLK-FIN-03 | To verify | |
| F4 | FinancialOS checklist section Pass or Accepted risk | [Production checklist](./evolved-production-checklist.md#financialos) | To verify | |

**Section outcome:** ☐ Pass · ☐ Fail · ☐ Accepted risk

---

## Security gates

| # | Gate | Blocker ref | Status | Evidence ref |
|---|------|-------------|--------|--------------|
| S1 | RLS / cross-tenant denial smoke completed | BLK-SEC-03 | To verify | |
| S2 | Staff PIN policy documented | BLK-SEC-04 | To verify | |
| S3 | Audit/report API session auth verified on production URL | BLK-LEG-02 | To verify | |
| S4 | Master checklist must-fix items triaged | [Master checklist](../runbooks/fi-os-production-hardening-master-checklist.md) | To verify | |
| S5 | Migration parity confirmed for release branch | [Production readiness §2](../runbooks/fi-os-production-readiness.md) | To verify | |

**Section outcome:** ☐ Pass · ☐ Fail · ☐ Accepted risk

---

## Staff readiness gates

| # | Gate | Blocker ref | Status | Evidence ref |
|---|------|-------------|--------|--------------|
| R1 | ReceptionOS dry-run confirmed; live send flags audited | BLK-REC-01 | To verify | |
| R2 | AcademyOS partial — manual privilege check on procedure day | BLK-ACA-01 | To verify | |
| R3 | MedicationOS embedded-only — DoctorOS Rx SoR acknowledged | BLK-MED-01 | To verify | |
| R4 | Evolved clinic lead sign-off on end-to-end SMOKETEST- journey | FI-PH1 completion criterion 7 | To verify | |
| R5 | Role matrix understood (CRM, clinical, financial operators) | BLK-SEC-04 | To verify | |

**Section outcome:** ☐ Pass · ☐ Fail · ☐ Accepted risk

---

## Monitoring gates

| # | Gate | Blocker ref | Status | Evidence ref |
|---|------|-------------|--------|--------------|
| M1 | `pnpm run smoke:prod` post-deploy pass recorded | BLK-SEC-05 | To verify | |
| M2 | System status / readiness panel reviewed | [System status design](../design/20-system-status-and-readiness.md) | To verify | |
| M3 | Intelligence Bus production-off acknowledged | BLK-INT-01 | To verify | |
| M4 | Analytics journey gaps acknowledged | BLK-X-05 | To verify | |
| M5 | Error sanitisation and logging posture reviewed | Master checklist | To verify | |

**Section outcome:** ☐ Pass · ☐ Fail · ☐ Accepted risk

---

## Known accepted risks

*Document only risks explicitly signed by executive sponsor with owner + date.*

| Risk ID | Summary | Owner | Accepted date | Expiry / review |
|---------|---------|-------|---------------|-----------------|
| BLK-INT-01 | Intelligence Bus off in production | To verify | To verify | Post-FI-PH1 governance |
| BLK-ACA-01/02 | AcademyOS partial — manual privilege checks | To verify | To verify | Post-FI-PH1 |
| BLK-MED-01 | MedicationOS embedded-only | To verify | To verify | Post-FI-PH1 |
| BLK-X-05 | Analytics publishers incomplete for full journey | To verify | To verify | Post-FI-PH1 |
| BLK-X-04 | Surgery plan not on patient timeline feed | To verify | To verify | Post-FI-PH1 |
| BLK-DCR-01/02 | Dual code roots — no consolidation during freeze | To verify | To verify | Post-FI-PH1 |
| — | Add rows only with signed acceptance | | | |

---

## Final decision matrix

| Condition | Decision |
|-----------|----------|
| All Critical safety gates **Pass**; no unresolved **Block** in risk register; scorecard ≥ 95 | **GO** |
| Critical gates **Pass** or **Accepted risk** with signed mitigation; P1 mitigations in place; scorecard ≥ 95 or documented deductions | **GO WITH MITIGATION** |
| Any Critical gate **Fail** without acceptance; or any P0 **Block** open; or scorecard &lt; 95 without sponsor approval | **NO-GO** |

---

## Sign-off

| Role | Name | Signature / date | Decision |
|------|------|------------------|----------|
| Evolved clinic lead | To verify | To verify | |
| FI platform lead | To verify | To verify | |
| Security / infra | To verify | To verify | |
| Executive sponsor | To verify | To verify | ☐ GO · ☐ GO WITH MITIGATION · ☐ NO-GO |

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| To verify | FI-PH1 Task 3 — go/no-go checklist created | — |
