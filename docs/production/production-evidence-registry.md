# Evolved Production — Evidence Registry

**Sprint:** FI-PH1 Task 6  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Registry date:** 2026-06-27  
**Purpose:** Single index of all production deployment evidence with verification status  
**Attachment root:** `docs/production/evidence/attachments/` (create as operators capture artifacts)

**Related**

- [Final P0 execution dashboard](./final-p0-execution-dashboard.md)
- [P0 operator execution checklist](./evolved-p0-operator-execution-checklist.md)

---

## Registry status summary

| Domain | Items | Verified | Pending | Blocking |
|--------|------:|---------:|--------:|---------:|
| Infrastructure | 3 | 0 | 3 | 3 |
| Security | 4 | 0 | 4 | 4 |
| Identity | 3 | 0 | 3 | 3 |
| Financial | 3 | 0 | 3 | 3 |
| **Total** | **13** | **0** | **13** | **13** |

**Engineering-only evidence (not production deployment proof):**

| Item | Source | Date | Verified by | Status |
|------|--------|------|-------------|--------|
| Typecheck pass | `pnpm run typecheck` (Task 5) | 2026-06-27 | FI-PH1 agent | Complete (dev) |
| Env validation pass | `pnpm run check:env` (Task 5) | 2026-06-27 | FI-PH1 agent | Complete (local `.env.local`) |
| Production rules unit tests | `check:env:production-rules` 17/17 (Task 4) | 2026-06-27 | FI-PH1 agent | Complete (CI/local) |
| Financial guard unit tests | `bookingSurgeryFinancialClearanceGuardCore.test.ts` 4/4 | 2026-06-27 | FI-PH1 agent | Complete (unit) |
| Static P0 code audits | Tasks 4–5 evidence files | 2026-06-27 | FI-PH1 agent | Complete (static) |

---

## Infrastructure evidence

### E-INF-01 — Supabase PITR screenshot

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-01 |
| **Evidence source** | Supabase Dashboard → Project Settings → Database → Backups |
| **Expected artifact** | `evidence/attachments/blk-sec-01-pitr-<YYYY-MM-DD>.png` |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-INF-02 — Database restore drill log

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-01 |
| **Evidence source** | Isolated staging restore per [fi-os-supabase-backup-setup.md](../runbooks/fi-os-supabase-backup-setup.md) §7 |
| **Expected artifact** | Drill log table in [backup-disaster-recovery-audit.md](./evidence/backup-disaster-recovery-audit.md) |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-INF-03 — Storage restore confirmation

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-01 |
| **Evidence source** | [fi-os-storage-backup-restore-drill.md](../runbooks/fi-os-storage-backup-restore-drill.md) |
| **Expected artifact** | Signed URL read test output in backup audit drill log |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

---

## Security evidence

### E-SEC-01 — Vercel environment variables verified

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-02, BLK-LEG-01 |
| **Evidence source** | Vercel → Project → Settings → Environment Variables (Production) |
| **Expected artifact** | Redacted export; `FI_LEGACY_FI_API_ENABLED` screenshot; `EVOLVED_PERTH_TENANT_ID` confirmed |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-SEC-02 — Secret rotation log

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-02 |
| **Evidence source** | Sprint change log + [cron-and-secrets-audit.md](./evidence/cron-and-secrets-audit.md) § Secret rotation log |
| **Expected artifact** | Dated rotation entries for `CRON_SECRET`, service role, integration secrets (no secret values) |
| **Verification date** | 2026-06-30 |
| **Verified by** | Platform ops (programmatic) |
| **Status** | **Verified present** — full rotation deferred; see [cron audit](./evidence/cron-and-secrets-audit.md) § Secret rotation log |

### E-SEC-03 — Cron execution logs (HTTP 200)

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-02 |
| **Evidence source** | Vercel → Cron Jobs → execution history |
| **Expected artifact** | `attachments/blk-sec-02-cron-probes-2026-06-30.txt` (programmatic substitute for Vercel screenshots) |
| **Verification date** | 2026-06-30 |
| **Verified by** | Platform ops |
| **Status** | **Partial** — reminder + financial **200**; HR **503** (Vercel `EVOLVED_PERTH_TENANT_ID` missing) |

### E-SEC-04 — Webhook secret validation

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-02 (related) |
| **Evidence source** | `pnpm run smoke:prod` wrong-secret 401 checks; Timely/HubSpot secret length in Vercel |
| **Expected artifact** | `evidence/attachments/smoke-prod-2026-06-30.txt` |
| **Verification date** | 2026-06-30 |
| **Verified by** | Platform ops |
| **Status** | **Complete** |

---

## Identity evidence

### E-ID-01 — Real Evolved staff accounts created

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-05 |
| **Evidence source** | Supabase Auth invites + `fi_users` rows (production) |
| **Expected artifact** | Redacted UUID table in [evolved-identity-audit.md](./evidence/evolved-identity-audit.md) |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-ID-02 — fi_users linked correctly

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-05 |
| **Evidence source** | `fi_users.auth_user_id` populated; staff ↔ user link admin |
| **Expected artifact** | Read-only SQL probe or admin screenshot |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-ID-03 — Staff PIN validation successful

| Field | Value |
|-------|-------|
| **Blocker** | BLK-SEC-05 (related BLK-SEC-04) |
| **Evidence source** | Clinic floor PIN session on reception/calendar actions |
| **Expected artifact** | Smoketest note: PIN login + blocked mutation under PIN policy |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

---

## Financial evidence

### E-FIN-01 — Staff signed financial clearance SOP

| Field | Value |
|-------|-------|
| **Blocker** | BLK-FIN-01 |
| **Evidence source** | [evolved-financial-clearance-sop.md](./evolved-financial-clearance-sop.md) §6 |
| **Expected artifact** | Signed sign-off + training acknowledgement tables |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-FIN-02 — Surgery deposit clearance workflow validated

| Field | Value |
|-------|-------|
| **Blocker** | BLK-FIN-02 |
| **Evidence source** | Procedure-day checklist execution on SMOKETEST case; manual deposit record before confirm |
| **Expected artifact** | Smoketest journey steps 7–9 evidence |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |

### E-FIN-03 — Booking financial guard successfully tested

| Field | Value |
|-------|-------|
| **Blocker** | BLK-FIN-02 |
| **Evidence source** | Staging: surgery within 14d + FinancialOS `not_ready` → confirm blocked |
| **Expected artifact** | Test note / screenshot with guard error message |
| **Verification date** | — |
| **Verified by** | — |
| **Status** | **Pending** |
| **Engineering reference** | `updateBooking` + `bookingSurgeryFinancialClearanceGuard` (Task 5); unit tests pass |

---

## Verification workflow

1. Operator captures artifact → save under `evidence/attachments/` with blocker prefix.
2. Update this registry row: **Verification date**, **Verified by**, **Status** → Complete.
3. Update linked evidence audit closure checklist item.
4. Update [final-p0-execution-dashboard.md](./final-p0-execution-dashboard.md) blocker status.
5. Re-run [readiness-scorecard.md](./readiness-scorecard.md) when all P0 evidence complete.

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-27 | FI-PH1 Task 6 — registry created; all deployment evidence Pending | FI-PH1 execution |
