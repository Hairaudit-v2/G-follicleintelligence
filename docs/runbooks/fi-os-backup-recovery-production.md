# FI OS — Backup and recovery (production proposal)

**Status:** Audit / proposal only — no infrastructure changes performed.  
**Data plane:** Supabase Postgres + Supabase Storage + Supabase Auth (users for FI OS and patient portal).

**Operational runbooks (2026-06-12+):** [Supabase backup / PITR setup](fi-os-supabase-backup-setup.md) · [Storage backup / restore drill](fi-os-storage-backup-restore-drill.md) · [Rollback playbook](fi-os-rollback-playbook.md) · [Production release checklist](fi-os-production-release-checklist.md) · [Master checklist](fi-os-production-hardening-master-checklist.md)

---

## Current schema posture (from migrations)

- **~90 SQL migrations** under `supabase/migrations/` covering FoundationOS (persons/patients/clinics), LeadFlow/CRM, bookings, pathology, prescribing, reminders, staff/PINs, payments, integration webhook inbox (`fi_integration_webhook_events`), etc.
- **RLS** is enabled on multiple tenant-scoped tables (e.g. integration webhook events policy in `20260721120001_fi_integration_webhook_events.sql`).
- **Service role** used heavily by Next.js routes — backups must assume **full data** includes sensitive columns not visible to `authenticated` role.

---

## 1. Database backups

### Recommended primary: Supabase managed backups

- Enable **Point-in-Time Recovery (PITR)** on the production Supabase project (paid tier capability — confirm against your Supabase plan).
- Retention: align with regulatory expectations for **health-related** data (often 7+ years for clinical records — confirm with legal/clinical governance; adjust PITR vs legal hold strategy).

### Logical exports (secondary)

- Periodic **`pg_dump`** (schema + data) to immutable object storage (S3/GCS) with **encryption at rest** and **separate IAM** from application Vercel env.
- **Frequency:** daily minimum for FI OS; consider pre-migration snapshot before each production deploy.
- **Secrets:** `SUPABASE_DB_PASSWORD` appears in maintenance scripts (`scripts/apply-*-remote.mjs`) — **rotate** if dumps are automated; prefer Supabase CLI with scoped credentials.

### What to include in scope

- All `public` / `auth` tables used by FI (not only CRM): `fi_*`, `fi_crm_*`, `fi_reminder_*`, pathology, imaging metadata, audit tables, `fi_staff_sync_runs`, etc.

---

## 2. Storage bucket backups

**Bucket:** Default intake bucket name `fi-intakes` unless overridden by `FI_STORAGE_BUCKET_INTAKES`.

| Approach | Pros | Cons |
|----------|------|------|
| Supabase dashboard / API replication to secondary project | Simple DR copy | Cost + consistency lag |
| Object replication (S3-compatible) via worker | Off-platform durability | Build + monitor |
| Periodic full bucket sync (rclone) | Verifiable offline copy | Bandwidth; eventual consistency |

**Recommendation:** nightly incremental sync to **versioned** cold storage; test restore quarterly.

---

## 3. Patient images / pathology / media recovery

- **DB** stores metadata (`fi_uploads`, `fi_media_assets`, pathology PDF paths, etc.) — restore DB **first** or in lockstep with storage.
- **Storage** holds binary PHI — treat as **same sensitivity** as database.
- **Recovery test:** pick one tenant → restore staging bucket prefix → verify signed URL / service-role read paths used by FI Admin still resolve.

---

## 4. RLS-safe restore considerations

| Topic | Guidance |
|-------|----------|
| Restore into **clean project** | Easiest: replay migrations then `pg_restore` data, or restore Supabase backup into new instance |
| Restore **over** existing | Risk of PK collisions and orphaned auth users — avoid unless emergency |
| **Service role** after restore | Rotate `SUPABASE_SERVICE_ROLE_KEY` if compromise suspected |
| **Auth.users** | Patient portal and operators live here — include in DR scope |
| **RLS policies** | Re-run migration verification on restore target (policy drift if manual hotfixes existed) |

---

## 5. Migration rollback strategy

| Layer | Approach |
|-------|----------|
| Forward-only migrations | Standard — **no automated down** in repo |
| App rollback | Revert Vercel deployment to prior Git SHA **while DB compatible** |
| DB rollback | Prefer **restore from backup / PITR** to timestamp **before** bad migration; avoid hand-editing prod |
| Pre-deploy | Run migrations on **staging** clone with anonymised data; measure time + lock risk |

**Breaking migrations:** use expand/contract pattern (add column → dual-write → backfill → switch reads → drop old).

---

## 6. Pre-deploy checklist (DB + storage)

- [ ] Staging applied same migration set successfully
- [ ] Long-running migration window communicated (maintenance page if needed)
- [ ] `supabase db diff` / migration checksum reviewed for **RLS** and **SECURITY DEFINER** functions
- [ ] Backup completed (or PITR window verified)
- [ ] Storage bucket CORS / policies unchanged or reviewed
- [ ] Post-deploy smoke: login, one read + one write per critical module (CRM, calendar, patient chart, reminder enqueue)

---

## 7. Disaster recovery checklist

- [ ] **RTO/RPO** documented (recovery time / max acceptable data loss)
- [ ] Contact tree + Supabase + Vercel + domain DNS access verified
- [ ] Latest **known-good** deployment tag recorded
- [ ] Restore drill: rebuild project from backup to **isolated** Supabase + restore storage subset
- [ ] Validate **cron secrets** and **integration secrets** still match schedulers after host change
- [ ] Legal / breach notification process if PHI exposure suspected

---

## 8. Gaps identified in this audit

- No in-repo **automated backup** or **restore runbook** execution — operational docs live here only.
- **Reminder / comms** side effects on replay — restoring DB to older timestamp may duplicate sends if not coordinated with job queue state.
- **Webhook inbox** (`fi_integration_webhook_events`) may contain raw payloads — include in **DLP / retention** policy.

---

## References

- [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md)
- [`docs/runbooks/fi-os-env-vars-production-audit.md`](fi-os-env-vars-production-audit.md)
- [`docs/runbooks/fi-os-supabase-backup-setup.md`](fi-os-supabase-backup-setup.md)
- [`docs/runbooks/fi-os-storage-backup-restore-drill.md`](fi-os-storage-backup-restore-drill.md)
- [`docs/runbooks/fi-os-rollback-playbook.md`](fi-os-rollback-playbook.md)
- [`docs/runbooks/fi-os-production-release-checklist.md`](fi-os-production-release-checklist.md)
