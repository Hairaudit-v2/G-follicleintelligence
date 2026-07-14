# Evolved Production Evidence — Backup & Disaster Recovery Audit

**Sprint:** FI-PH1 Task 4  
**Blocker:** BLK-SEC-01  
**Tenant scope:** Evolved Hair Restoration (Perth)  
**Audit date:** 2026-06-27  
**Auditor:** FI-PH1 execution agent (code + runbook static review; no production Supabase dashboard access)

---

## Executive summary

| Check | Status | Evidence |
|-------|--------|----------|
| PITR enabled on production Supabase project | **Yes (E1)** | `attachments/blk-sec-01-pitr-2026-06-30.png` |
| Daily automated backups succeeding | **Yes (E2)** | `attachments/blk-sec-01-daily-backups-2026-06-30.png` (PITR mode) |
| Documented restore procedure exists | **Yes** | Runbooks present and cross-linked |
| Storage restore drill executed | **Yes — AMBER (E5)** | 14/14 objects size+SHA-256 verified; signed URL PASS; unsigned private DENIED; long-term Storage backup not defined — [`fi-security-restore-drill-1.md`](../../security/fi-security-restore-drill-1.md) |
| DB restore drill executed | **Yes (E4)** | Isolated staging `jzphojhurhguitfuuizo`; DB + app validators PASS 2026-07-14 — see drill log + findings |
| RPO/RTO signed | **Yes (E3)** | Paul Green 30 June 2026 — § RPO/RTO below |

**Verdict:** BLK-SEC-01 **remains blocking**. E1–E5 evidenced (E5 **AMBER**); **E6 master checklist / verifier / cleanup** still open. Security scorecard stays **0** until E6 closes.

---

## Artifacts reviewed

| Artifact | Path | Finding |
|----------|------|---------|
| Supabase backup / PITR setup checklist | `docs/runbooks/fi-os-supabase-backup-setup.md` | All checklist items unchecked (template) |
| Storage backup / restore drill | `docs/runbooks/fi-os-storage-backup-restore-drill.md` | Procedure defined; no execution record |
| Backup & recovery proposal | `docs/runbooks/fi-os-backup-recovery-production.md` | Status: audit/proposal only; ~90 migrations; PHI scope documented |
| Rollback playbook | `docs/runbooks/fi-os-rollback-playbook.md` | DB rollback via PITR/restore only; cron/webhook pause documented |
| Master hardening checklist | `docs/runbooks/fi-os-production-hardening-master-checklist.md` | Backup/PITR + restore drill explicitly **pending manual completion** |
| Risk register | `docs/production/evolved-go-live-risk-register.md` | BLK-SEC-01 marked **Block** / **Not started** |
| Local Supabase config | `supabase/config.toml` | Dev ports only; no production backup settings |
| Supabase CLI | v2.106.0 (local) | Cannot infer remote PITR tier without linked project + dashboard |

---

## PITR availability (codebase inference)

- FI OS assumes Supabase **managed backups + optional PITR** on a paid tier (`fi-os-supabase-backup-setup.md` §1).
- Application code has **no** runtime check for PITR status.
- `pnpm run check:env` validates env vars and REST connectivity only — **not** backup tier.
- **Cannot confirm** PITR is enabled without Supabase Dashboard → Project Settings → Database → Backups (or Supabase MCP/API with org credentials).

**Gap:** No script or CI step records backup/PITR status for go-live evidence.

---

## Restore drill status

### Database

- Runbook requires **quarterly non-production restore** to isolated staging (`fi-os-supabase-backup-setup.md` §7).
- Pre-migration backup rule documented (§6).
- `auth.users` included in DR scope (§5) — critical for `fi_users.auth_user_id` alignment.

**Drill log in repo:** None found.

### Storage

- Bucket default: `fi-intakes` (override: `FI_STORAGE_BUCKET_INTAKES`).
- Drill steps: restore DB + storage to aligned timestamp; verify signed URLs in staging (`fi-os-storage-backup-restore-drill.md`).
- Hard rule: never restore production PHI to unsecured dev (`§7`).

**Drill log in repo:** None found.

---

## Storage backup configuration

| Approach | Documented | Implemented in repo |
|----------|------------|---------------------|
| Supabase dashboard replication | Yes | N/A (operator) |
| External object sync (rclone/worker) | Yes (proposal) | No automation scripts |
| Versioned cold storage | Recommended | Not configured in codebase |

**Gap:** No scheduled storage export job in `vercel.json` or Supabase Edge Functions for FI-PH1 scope.

---

## PHI / access control

Runbooks correctly flag backups as **full-fidelity PHI** (`fi-os-supabase-backup-setup.md` §9). Access list for backup operators is a **template only** (§8) — not filled.

---

## Safe commands executed

```text
pnpm run check:env          → PASS (Supabase REST probe)
pnpm run typecheck          → PASS
supabase --version          → 2.106.0
```

No destructive or production restore operations were run.

---

## Remediation required (P0)

1. **Enable and verify PITR** on production Supabase project; screenshot or export retention window.
2. **Verify daily backup success** in dashboard; set failure alerting.
3. **Execute storage + DB restore drill** per runbooks into **isolated staging**; record:
   - Operator name, date (UTC), source backup timestamp
   - Row count / checksum sample for one non-PHI or synthetic table
   - Signed URL read test on restored bucket prefix
4. **Document RPO/RTO** with clinical/ops sign-off.
5. **Complete master checklist** items in `fi-os-production-hardening-master-checklist.md`.
6. **Optional (Task 5):** Add a read-only `scripts/audit-supabase-backup-status.ts` that operators run post-login — **not** implemented in Task 4 (architecture freeze; manual dashboard remains SoR).

---

## BLK-SEC-01 disposition

| Field | Value |
|-------|-------|
| Validated | Yes — gap confirmed against runbooks + checklist |
| Resolved automatically | **No** — requires Supabase/Vercel operator access |
| Still blocking production | **Yes** — E6 only (E1–E4 PASS; E5 AMBER 2026-07-14) |
| Task 5 disposition | **Still blocking** — E6 verifier/cleanup + long-term Storage backup decision; E1–E5 technical drill done |

---

## Evidence Closure Checklist

Complete each item; attach artifacts under `docs/production/evidence/attachments/` or linked runbook. Mark **Complete**, **Accepted risk**, or **Still blocking**.

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | PITR enabled screenshot (retention window visible) | attachments/blk-sec-01-pitr-2026-06-30.png | Paul Green | 2026-06-30 | ☑ |
| E2 | Daily backup success (7-day view) | attachments/blk-sec-01-daily-backups-2026-06-30.png | Paul Green | 2026-06-30 | ☑ |
| E3 | RPO/RTO signed by clinical + ops | Row in this doc § RPO/RTO | Sprint lead | 2026-06-30 | ☑ |
| E4 | DB restore drill log (isolated staging) | § Restore drill log below + [`fi-security-restore-drill-1.md`](../../security/fi-security-restore-drill-1.md) | Platform / infra | 2026-07-14 | ☑ Complete (app smoke 8/8; auth orphan SQL still optional follow-up) |
| E5 | Storage restore + signed URL test | § Restore drill log — Storage rows; `npm run audit:restore-drill:storage` | Platform / infra | 2026-07-14 | ☑ AMBER (technical PASS; long-term Storage backup undefined) |
| E6 | Master hardening checklist backup items ticked | Link to signed checklist export | Platform / infra | | ☐ Still open (verifier / cleanup / P0 close) |

### Restore drill log (template)

| Field | Value |
|-------|-------|
| Operator | thelo |
| Date (UTC) | 2026-07-14 |
| Environment | Isolated staging only — project `jzphojhurhguitfuuizo` |
| Source backup timestamp | PITR after marker `2026-07-14T06:21:38.292Z` (exact selected UTC **not** captured in validator env) |
| DB restore result | ☑ Pass / ☐ Fail — DB validator PASS `2026-07-14T08:17:59.643Z`; findings [`fi-security-restore-drill-1.md`](../../security/fi-security-restore-drill-1.md) |
| Row count / checksum sample | 17/17 critical tables counted; marker lead present; see findings Critical table results |
| App validation | ☑ Pass — operational-day smoke **8/8**; app validated `2026-07-14T09:37:18.138Z`; local evidence `docs/security/restore-drill-evidence/restored-application-jzphojhurhguitfuuizo-2026-07-14T09-37-18-138Z.json` (gitignored) |
| Auth linkage | Partial — 11/11 linked `fi_users`→`fi_staff` PASS; dedicated `auth.users` orphan SQL **PENDING** |
| Storage bucket restored | ☑ `patient-images` + `tenant-branding` binaries on isolated recovery — 14 objects / 20 054 377 bytes; 12 copied this run; 14 SHA-256 match |
| Signed URL read test | ☑ Pass — short-lived signed GET PASS; unsigned private DENIED; branding readable per policy |
| Verifier | — |

### Recovery marker (E4 prep — 2026-07-14)

PITR retention is **7 days** (not extended). The Jun-30 journey marker is outside that window and is **superseded** for this drill. A new non-PHI SMOKETEST lead was inserted on production Evolved so the probe sits inside retention.

| Field | Value |
|-------|-------|
| Marker ID (canonical) | `SMOKETEST-RECOVERY-MARKER-20260714` |
| Primary table / id | `fi_crm_leads` / `70f2e1b0-e8b7-472e-8f3e-bb59c4b92511` |
| Marker created_at (UTC) | `2026-07-14T06:21:38.292185+00:00` |
| Earliest PITR (UTC) | `2026-07-14T06:21:39.292Z` (must also be within 7d retention) |
| Verified at (UTC) | `2026-07-14T06:21:47.809Z` — **PASS** |
| Env | Production (`iqqvzgxoimxchhcnbzxl.supabase.co`) |
| Seed | `scripts/seed-blk-sec-01-recovery-marker.ts` |
| Evidence | [`blk-sec-01-recovery-marker-2026-07-14.md`](./blk-sec-01-recovery-marker-2026-07-14.md), [`attachments/blk-sec-01-recovery-marker-verify.json`](./attachments/blk-sec-01-recovery-marker-verify.json), [`attachments/blk-sec-01-recovery-marker-seed.json`](./attachments/blk-sec-01-recovery-marker-seed.json) |
| Verify command | `scripts/verify-blk-sec-01-recovery-marker.ts` (read-only; primary marker required) |
| Staging SQL | [`attachments/blk-sec-01-recovery-marker-verify.sql`](./attachments/blk-sec-01-recovery-marker-verify.sql) |
| Legacy (superseded) | `SMOKETEST-JOURNEY-001-20260630` / `66b47348-bf0e-48b7-a188-accbee0db4a3` (`2026-06-30T12:26:30Z`) — outside 7d PITR |

**Next step (E6):** Verifier initials; master checklist formal close; cleanup/retention of drill project; confirm production Vercel never points at drill keys; file quarterly reminder; decide operated long-term Storage backup to promote E5 AMBER → PASS. Do **not** restore onto production.

**2026-06-30 status:** PITR enabled and RPO/RTO signed (E1–E3).

**2026-07-14 status:** E4 DB+app PASS; E5 Storage binary drill **AMBER** (14/14 checksums + access controls; no independent long-term Storage backup yet).

### RPO / RTO Operational Sign-Off

Production tenant: Evolved Hair Restoration

Recovery Point Objective (RPO)

Maximum acceptable data loss in production event:

15 minutes

Rationale:

The platform manages active clinical scheduling, patient workflow state, financial tracking, and surgical coordination. Data loss beyond 15 minutes creates operational risk.

Recovery Time Objective (RTO)

Maximum acceptable platform downtime:

2 hours

Rationale:

The clinic can temporarily operate manually for short interruptions, but downtime exceeding 2 hours may disrupt consultations, bookings, surgery coordination, and patient management.

Operational Sign-Off

Approved by:

Paul Green

Role:

Platform Owner / Deployment Lead

Date:

30 June 2026

Status:

Approved


**Closure rule:** BLK-SEC-01 → **Complete** when E1–E6 are Complete with verifier initials, or **Accepted risk** with clinic lead + dated mitigation.
