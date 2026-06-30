# Evolved P0 — Operator Execution Checklist

**Sprint:** FI-PH1 Task 5  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Purpose:** Single operator runbook to close remaining P0 blockers with attachable evidence.  
**Architecture freeze:** Active — evidence capture and minimal hardening only.

**Related evidence files**

- [Backup & DR audit](./evidence/backup-disaster-recovery-audit.md) — BLK-SEC-01
- [Cron & secrets audit](./evidence/cron-and-secrets-audit.md) — BLK-SEC-02
- [Legacy API decision](./evidence/legacy-api-decision.md) — BLK-LEG-01
- [Financial safety audit](./evidence/financial-safety-audit.md) — BLK-FIN-01, BLK-FIN-02
- [Identity audit](./evidence/evolved-identity-audit.md) — BLK-SEC-05
- [Financial clearance SOP](./evolved-financial-clearance-sop.md)

---

## How to use

1. Execute items **in order** (infra → access → financial → validation).
2. Attach redacted screenshots, exports, or log excerpts to the linked evidence file.
3. Mark each item **Complete**, **Accepted risk**, or **Still blocking** with owner + target date.
4. Do **not** mark go/no-go until all P0 rows are Complete or formally Accepted risk.

| Status | Meaning |
|--------|---------|
| **Complete** | Evidence attached; verifier initialled |
| **Accepted risk** | Named owner, mitigation, expiry/review date, clinic lead sign-off |
| **Still blocking** | Owner + next action + date recorded |

---

## 1. Supabase PITR / backup confirmation (BLK-SEC-01)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 1.1 | Supabase Dashboard → Project Settings → Database → Backups: confirm **PITR enabled** and retention window | Screenshot: `evidence/attachments/blk-sec-01-pitr-2026-06-30.png` | ☑ |
| 1.2 | Confirm **daily automated backups** succeeding (last 7 days green) | `blk-sec-01-daily-backups-2026-06-30.png` (PITR mode — daily full backups N/A) | ☑ |
| 1.3 | Record RPO/RTO with clinical ops sign-off | Signed row in [backup audit](./evidence/backup-disaster-recovery-audit.md) | ☑ |

**Runbook:** [`docs/runbooks/fi-os-supabase-backup-setup.md`](../runbooks/fi-os-supabase-backup-setup.md)

---

## 2. Restore drill log (BLK-SEC-01)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 2.1 | Restore **database** to isolated staging from production backup/PITR point | Drill log table in [backup audit](./evidence/backup-disaster-recovery-audit.md) | ☐ |
| 2.2 | Verify sample row counts / non-PHI checksum on restored DB | SQL output pasted in drill log | ☐ |
| 2.3 | Confirm `auth.users` + `fi_users.auth_user_id` alignment spot-check | Drill log § auth linkage | ☐ |

**Runbook:** [`docs/runbooks/fi-os-supabase-backup-setup.md`](../runbooks/fi-os-supabase-backup-setup.md) §7

---

## 3. Storage restore verification (BLK-SEC-01)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 3.1 | Restore `fi-intakes` (or `FI_STORAGE_BUCKET_INTAKES`) to staging at aligned timestamp | Drill log in [backup audit](./evidence/backup-disaster-recovery-audit.md) | ☐ |
| 3.2 | Signed URL read test on restored prefix | curl/log output in drill log | ☐ |
| 3.3 | Confirm no production PHI restored to unsecured dev | Operator attestation in drill log | ☐ |

**Runbook:** [`docs/runbooks/fi-os-storage-backup-restore-drill.md`](../runbooks/fi-os-storage-backup-restore-drill.md)

---

## 4. Vercel secret rotation confirmation (BLK-SEC-02)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 4.1 | Rotate `CRON_SECRET`, `FI_REMINDER_CRON_SECRET`, service role (if policy requires) | Change log entry: date, vars rotated, approver | ☐ |
| 4.2 | Confirm production env: `EVOLVED_PERTH_TENANT_ID`, IIOHR chain, Resend (if reminders live) | Redacted Vercel env export | ☐ |
| 4.3 | Confirm insecure dev flags **absent** in production (`FI_ALLOW_INSECURE_API`, etc.) | `pnpm run check:env:production-rules` output against prod vars (local copy) | ☐ |

**Reference:** [Cron & secrets audit](./evidence/cron-and-secrets-audit.md) § Required secrets

---

## 5. Cron 200-log confirmation (BLK-SEC-02)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 5.1 | Vercel → Cron Jobs: last run **200** for `/api/cron/fi-reminder-jobs` | Screenshot: `blk-sec-02-cron-reminder-<date>` | ☐ |
| 5.2 | Last run **200** for `/api/cron/iiohr-hr-perth-staff-sync` | Screenshot: `blk-sec-02-cron-hr-<date>` | ☐ |
| 5.3 | Last run **200** for FinancialOS jobs (deposit_overdue, clearance-snapshots) | Screenshot: `blk-sec-02-cron-financial-<date>` | ☐ |
| 5.4 | Run `pnpm run smoke:prod` against production URL (401 on bad secrets) | Console log saved to `evidence/attachments/smoke-prod-<date>.txt` | ☐ |
| 5.5 | Confirm **single** active reminder worker (Edge vs Vercel — disable duplicate) | Note in [cron audit](./evidence/cron-and-secrets-audit.md) | ☐ |

---

## 6. Legacy API OFF — screenshot / sign-off (BLK-LEG-01)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 6.1 | Vercel production: `FI_LEGACY_FI_API_ENABLED=false` or **unset** | Screenshot: `blk-leg-01-legacy-flag-<date>` | ☐ |
| 6.2 | Evolved ops confirms no production caller needs `POST /api/fi/events` at go-live | Sign-off row in [legacy decision](./evidence/legacy-api-decision.md) | ☐ |
| 6.3 | Product owner accepts HLI/HairAudit machine ingest deferred or on internal paths | Sign-off row in legacy decision | ☐ |

---

## 7. Real Evolved staff Auth + fi_users provisioning (BLK-SEC-05)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 7.1 | Minimum **2** real operators: Supabase Auth invite + `fi_users` row with `auth_user_id` | Redacted UUIDs in [identity audit](./evidence/evolved-identity-audit.md) | ☑ |
| 7.2 | Payroll import dry-run → commit **or** verified IIOHR cron sync | 12 fi_staff rows; HR sync pending cron evidence | ☐ |
| 7.3 | Staff ↔ fi_users link for calendar operators | 10/12 linked (audit 2026-06-30) | ☑ |
| 7.4 | Remove or disable seed `@follicleintelligence.local` users in production (if present) | N/A on evolved-hair tenant | ☑ |

**Runbook:** [Identity audit § Recommended provisioning sequence](./evidence/evolved-identity-audit.md)

---

## 8. Authenticated smoke test confirmation (BLK-SEC-05)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 8.1 | Login as real Evolved admin → `/fi-admin/[tenantId]/cases` | `attachments/blk-sec-05-auth-cases-2026-06-30.jpeg` (David → SurgeryOS worklist, 3 cases) | ☑ |
| 8.2 | Cross-tenant denial: non-member auth user cannot access Evolved tenant | `smoke-prod-2026-06-30.txt` check J PASS | ☑ |
| 8.3 | Complete [smoketest journey](./evolved-smoketest-journey.md) authenticated sections | `smoketest-journey-manifest-2026-06-30.json` — 12/12 PASS | ☑ |

---

## 9. Financial SOP sign-off (BLK-FIN-01)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 9.1 | Staff training: `fi_payment_records` are **manual ops records**, not Stripe proof | Signed training ack in [financial SOP](./evolved-financial-clearance-sop.md) | ☐ |
| 9.2 | Finance admin acknowledges dual-truth risk (Stripe vs manual) if invoices enabled later | SOP sign-off table | ☐ |

---

## 10. Surgery deposit clearance SOP sign-off (BLK-FIN-02)

| # | Action | Evidence placeholder | Status |
|---|--------|----------------------|--------|
| 10.1 | Clinical ops sign [Financial clearance SOP](./evolved-financial-clearance-sop.md) | Sign-off table § Procedure-day | ☐ |
| 10.2 | Mandate manual surgery payment record **before** booking confirm (ops process) | SOP § Manual fallback | ☐ |
| 10.3 | Procedure-day checklist assigned to reception + finance contact | Named roles in SOP | ☐ |

**Code note (Task 5):** Server guard in `updateBooking` blocks surgery **confirmation** when FinancialOS clearance is explicitly `not_ready` and surgery is within 14 days. Does **not** replace manual SOP for untracked payments.

---

## P0 closure summary (operator fill-in)

| Blocker | Final status | Owner | Evidence link | Date |
|---------|--------------|-------|---------------|------|
| BLK-SEC-01 | ☐ Complete / ☐ Accepted risk / ☑ Blocking | Paul Green | [backup audit](./evidence/backup-disaster-recovery-audit.md) — drill pending | 2026-06-30 |
| BLK-SEC-02 | ☐ Complete / ☐ Accepted risk / ☑ Blocking | Paul Green | Cron screenshots pending | |
| BLK-LEG-01 | ☑ Complete / ☐ Accepted risk / ☐ Blocking | Paul Green | [legacy decision](./evidence/legacy-api-decision.md) | |
| BLK-FIN-01 | ☐ Complete / ☐ Accepted risk / ☑ Blocking | Paul Green | SOP sign-off pending | |
| BLK-FIN-02 | ☐ Complete / ☐ Accepted risk / ☑ Blocking | Paul Green | SOP sign-off pending | |
| BLK-SEC-05 | ☑ Complete / ☐ Accepted risk / ☐ Blocking | Paul Green | Identity audit E2+E5+E6 | 2026-06-30 |

**Verifier (name + date):** ___________________________
