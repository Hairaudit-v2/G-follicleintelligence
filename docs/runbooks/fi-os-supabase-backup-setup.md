# FI OS — Supabase backup and PITR setup checklist

**Purpose:** Operational checklist to enable and verify Supabase **managed backups** and **Point-in-Time Recovery (PITR)** for FI OS production, and to align access controls with **PHI / clinical data** obligations.  
**Related:** [Backup & recovery proposal](fi-os-backup-recovery-production.md) · [Storage restore drill](fi-os-storage-backup-restore-drill.md) · [Rollback playbook](fi-os-rollback-playbook.md) · [Master checklist](fi-os-production-hardening-master-checklist.md)

---

## 1. Enable Supabase PITR

- [ ] Confirm the production project is on a **Supabase plan** that includes PITR (feature availability and retention vary by tier — verify in [Supabase pricing / dashboard](https://supabase.com/docs/guides/platform/backups)).
- [ ] In **Supabase Dashboard → Project Settings → Database → Backups**, enable **Point-in-Time Recovery** if not already on.
- [ ] Record **PITR retention window** (e.g. 7 days vs longer) in your internal RPO section (§4) and in compliance documentation.
- [ ] Ensure **only** authorised org roles can change backup settings (see §8).

---

## 2. Verify daily backups

- [ ] Confirm **automated daily backups** are listed and succeeding in the Supabase dashboard (or API/monitoring).
- [ ] Set a **calendar reminder** or alert if backup jobs fail (email/Slack via Supabase notifications or external monitor).
- [ ] Optionally export backup metadata (last success time, size) into your ops wiki each quarter.

---

## 3. Document RPO / RTO

**Definitions**

- **RPO (Recovery Point Objective):** Maximum acceptable **data loss** measured in time (e.g. “we accept up to 24 hours of loss” vs “we need sub-hour” — PITR changes what is achievable).
- **RTO (Recovery Time Objective):** Maximum acceptable **downtime** to restore service after a declared incident.

**Actions**

- [ ] Write down **target RPO** and **target RTO** for FI OS production (clinical + operational sign-off as required).
- [ ] Map targets to **actual** Supabase backup/PITR capabilities (retention, restore steps, staffing).
- [ ] Store the signed RPO/RTO in the same place as [production readiness](fi-os-production-readiness.md) sign-off.

---

## 4. Service role rotation policy

The app uses **`SUPABASE_SERVICE_ROLE_KEY`** server-side (bypasses RLS). Treat it as **root-equivalent** for data in Postgres + Storage APIs used with that client.

- [ ] **Onboard:** Key exists only in Vercel (production) + approved secret manager; never `NEXT_PUBLIC_*`, never client bundles.
- [ ] **Rotate** after: suspected leak, offboarding of someone with deploy access, major incident, or **at least annually** (adjust per policy).
- [ ] **Procedure:** Generate new key in Supabase → update Vercel env → redeploy → invalidate old key in Supabase after traffic is on new deployment.
- [ ] **Post-restore:** If a database or key material may have been exposed during DR, **rotate** service role (and other secrets) as part of recovery closure.

---

## 5. `auth.users` in DR thinking

FI OS and the patient portal rely on **Supabase Auth**. Recovery is not “public schema only.”

- [ ] Include **`auth.users`** (and related auth schema objects your flows use) in **scope** for backup/restore and RTO/RPO discussions.
- [ ] After any **restore to a new project**, plan for **Auth URL redirects**, **magic links**, and **user IDs** aligning with `fi_users.auth_user_id` and related tables — document who re-links or validates mappings.
- [ ] Avoid “restore public only” drills that leave **orphaned** app rows pointing at missing auth users.

---

## 6. Pre-migration backup rule

Before **production** migration apply:

- [ ] Confirm **latest backup succeeded** (or PITR window covers the deploy window).
- [ ] For high-risk migrations, take an **additional** snapshot or logical export per governance (see [backup & recovery](fi-os-backup-recovery-production.md) § logical exports).
- [ ] Record **migration version** / Git SHA in the change ticket alongside backup verification.

---

## 7. Staging restore drill schedule

- [ ] **At least quarterly:** perform a **non-production** restore drill (new Supabase project or dedicated staging) from backup or PITR to a **known timestamp**, without touching production.
- [ ] Use **synthetic or anonymised** data policy for staging; never copy production PHI into unsecured laptops or public preview URLs (see [storage drill](fi-os-storage-backup-restore-drill.md)).
- [ ] Log drill date, owner, outcome, and gaps in the master checklist or internal tracker.

---

## 8. Who has access to Supabase backups

- [ ] Maintain a **named list** of people/roles who can: view backups, trigger restore, download dumps, or change PITR settings.
- [ ] Align with **least privilege** (e.g. break-glass account separate from day-to-day dev keys).
- [ ] Review access **quarterly** or on role change.

---

## 9. PHI / clinical data — strict access control

**Warning:** FI OS stores and processes **protected health information (PHI)** and **clinical** context. Supabase backups, PITR restore exports, and Storage replicas contain **full fidelity** copies of that data — often **more** than what the UI shows to any single role.

- [ ] Backup download and restore paths require **the same or stricter** controls as production DB/Storage (encryption, access logging, need-to-know).
- [ ] Do not store backup files on **consumer sync drives**, unencrypted removable media, or shared channels without encryption and approval.
- [ ] Train staff: **screenshots, CSV exports, and “quick dumps”** from production are also PHI-bearing and must follow the same rules.

---

## Completion sign-off

| Task area | Owner | Date | Notes |
|-----------|-------|------|-------|
| PITR enabled + retention recorded | | | |
| Daily backups verified | | | |
| RPO/RTO documented | | | |
| Service role rotation policy acknowledged | | | |
| Pre-migration backup rule adopted | | | |
| Staging restore drill scheduled | | | |
