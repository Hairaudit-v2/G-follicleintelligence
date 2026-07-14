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
| Storage restore drill executed | **No (E5)** | Drill log template empty; no signed-URL artifact |
| DB restore drill executed | **No (E4)** | Drill log template empty; no staging restore record |
| RPO/RTO signed | **Yes (E3)** | Paul Green 30 June 2026 — § RPO/RTO below |

**Verdict:** BLK-SEC-01 **remains blocking**. PITR + RPO/RTO (E1–E3) are attached; **DB + storage restore drill (E4–E5) and master checklist tick (E6) are still missing**.

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
| Still blocking production | **Yes** — E4–E6 only |
| Task 5 disposition | **Still blocking** — operator checklist §2–3 (restore drills); E1–E3 complete 2026-06-30 |

---

## Evidence Closure Checklist

Complete each item; attach artifacts under `docs/production/evidence/attachments/` or linked runbook. Mark **Complete**, **Accepted risk**, or **Still blocking**.

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | PITR enabled screenshot (retention window visible) | attachments/blk-sec-01-pitr-2026-06-30.png | Paul Green | 2026-06-30 | ☑ |
| E2 | Daily backup success (7-day view) | attachments/blk-sec-01-daily-backups-2026-06-30.png | Paul Green | 2026-06-30 | ☑ |
| E3 | RPO/RTO signed by clinical + ops | Row in this doc § RPO/RTO | Sprint lead | 2026-06-30 | ☑ |
| E4 | DB restore drill log (isolated staging) | § Restore drill log below | Platform / infra | | ☐ Scheduled |
| E5 | Storage restore + signed URL test | § Storage drill log below | Platform / infra | | ☐ Scheduled |
| E6 | Master hardening checklist backup items ticked | Link to signed checklist export | Platform / infra | | ☐ |

### Restore drill log (template)

| Field | Value |
|-------|-------|
| Operator | Paul Green (scheduled) |
| Date (UTC) | 2026-07-14 — **prep only** (marker registered); restore TBD |
| Environment | Isolated staging only (restore not started) |
| Source backup timestamp | Choose PITR/backup **≥** `2026-06-30T12:26:45Z` (after marker) |
| DB restore result | ☐ Pass / ☐ Fail |
| Row count / checksum sample | Pending drill — post-restore use marker SQL below |
| Storage bucket restored | `fi-intakes` (pending) |
| Signed URL read test | ☐ Pass / ☐ Fail |
| Verifier | — |

### Recovery marker (E4 prep — 2026-07-14)

Runbooks define **no** separate marker insert table. Prep used existing production `SMOKETEST-` synthetic journey rows as the recoverability probe (read-only verify; **no production restore**).

| Field | Value |
|-------|-------|
| Marker ID | `SMOKETEST-JOURNEY-001-20260630` |
| Primary table / id | `fi_crm_leads` / `66b47348-bf0e-48b7-a188-accbee0db4a3` |
| Marker created_at (UTC) | `2026-06-30T12:26:30.431814+00:00` |
| Verified at (UTC) | `2026-07-14T06:13:58.653Z` — **PASS** |
| Env | Production (`iqqvzgxoimxchhcnbzxl.supabase.co`) — verify only |
| Evidence | [`blk-sec-01-recovery-marker-2026-07-14.md`](./blk-sec-01-recovery-marker-2026-07-14.md), [`attachments/blk-sec-01-recovery-marker-verify.json`](./attachments/blk-sec-01-recovery-marker-verify.json) |
| Verify command | `scripts/verify-blk-sec-01-recovery-marker.ts` (read-only) |
| Staging SQL | [`attachments/blk-sec-01-recovery-marker-verify.sql`](./attachments/blk-sec-01-recovery-marker-verify.sql) |

**Next E4 step:** Restore / clone production DB into a **new isolated staging** Supabase project from a PITR timestamp after the marker; confirm marker SQL Pass in staging; capture walkthrough Phase B artifacts. Do **not** restore onto production.

**2026-06-30 status:** PITR enabled and RPO/RTO signed (E1–E3). DB + storage restore drill (E4–E5) scheduled per [`fi-os-storage-backup-restore-drill.md`](../../runbooks/fi-os-storage-backup-restore-drill.md) — requires isolated staging project; not executed in this session.

**2026-07-14 status:** Recovery marker registered and verified on production (read-only). E4 restore into staging still pending.

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
