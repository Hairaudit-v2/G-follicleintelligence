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
| PITR enabled on production Supabase project | **Not verified** | No automated probe; dashboard access required |
| Daily automated backups succeeding | **Not verified** | Same |
| Documented restore procedure exists | **Yes** | Runbooks present and cross-linked |
| Storage restore drill executed | **No** | Master checklist unchecked; no drill log in repo |
| DB restore drill executed | **No** | Same |
| RPO/RTO signed | **Not verified** | Template in runbook only |

**Verdict:** BLK-SEC-01 **remains blocking**. Documentation is mature; **operational proof is missing**.

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
| Still blocking production | **Yes** |
| Task 5 disposition | **Still blocking** — operator checklist §1–3; evidence attachments pending |

---

## Evidence Closure Checklist

Complete each item; attach artifacts under `docs/production/evidence/attachments/` or linked runbook. Mark **Complete**, **Accepted risk**, or **Still blocking**.

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | PITR enabled screenshot (retention window visible) | `attachments/blk-sec-01-pitr-<YYYY-MM-DD>.png` | Platform / infra | | ☐ |
| E2 | Daily backup success (7-day view) | `attachments/blk-sec-01-daily-backups-<date>` | Platform / infra | | ☐ |
| E3 | RPO/RTO signed by clinical + ops | Row in this doc § RPO/RTO | Sprint lead | | ☐ |
| E4 | DB restore drill log (isolated staging) | § Restore drill log below | Platform / infra | | ☐ |
| E5 | Storage restore + signed URL test | § Storage drill log below | Platform / infra | | ☐ |
| E6 | Master hardening checklist backup items ticked | Link to signed checklist export | Platform / infra | | ☐ |

### Restore drill log (template)

| Field | Value |
|-------|-------|
| Operator | |
| Date (UTC) | |
| Environment | Isolated staging only |
| Source backup timestamp | |
| DB restore result | ☐ Pass / ☐ Fail |
| Row count / checksum sample | |
| Storage bucket restored | |
| Signed URL read test | ☐ Pass / ☐ Fail |
| Verifier | |

### RPO / RTO (template)

| Metric | Target | Signed by | Date |
|--------|--------|-----------|------|
| RPO | | | |
| RTO | | | |

**Closure rule:** BLK-SEC-01 → **Complete** when E1–E6 are Complete with verifier initials, or **Accepted risk** with clinic lead + dated mitigation.
