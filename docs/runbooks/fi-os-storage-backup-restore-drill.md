# FI OS — Storage backup and restore drill

**Purpose:** Define what to back up in **Supabase Storage** for FI OS, how to verify **signed URLs**, and how to run a **quarterly restore drill** safely (especially around **PHI**).  
**Related:** [Supabase backup / PITR setup](fi-os-supabase-backup-setup.md) · [Backup & recovery proposal](fi-os-backup-recovery-production.md) · [Rollback playbook](fi-os-rollback-playbook.md)

---

## 1. Buckets and data classes

Document your **actual** bucket names from Supabase Dashboard and from env (defaults in [FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md)).

| Area | Typical bucket / config | Contents |
|------|-------------------------|----------|
| **FI intakes / case uploads** | `fi-intakes` (override: `FI_STORAGE_BUCKET_INTAKES`) | Intake documents, case-related uploads, blood PDF pipeline inputs, related ingestion paths |
| **Patient images** | `patient-images` (per migrations / setup doc) | Patient-facing or clinical images (metadata often in DB) |
| **Pathology PDFs** | Often same allow-list as patient images in migrations — **confirm in Dashboard** MIME allow-list vs `application/pdf` | Pathology reports as PDF objects |
| **Imaging media** | Any bucket(s) used for imaging / media assets (DB columns such as media asset paths — confirm per tenant) | Imaging files referenced from patient chart / twin flows |

- [ ] Inventory **all** production buckets and prefixes used by FI OS.
- [ ] Mark each as **PHI** or **sensitive operational** — backup tooling must match that classification.

---

## 2. Backup approaches (choose and document)

Examples (not mutually exclusive):

- **Supabase-native:** replication to secondary project, dashboard exports, or provider features as available on your plan.
- **Object sync:** periodic **incremental** copy to **versioned** cold storage (e.g. S3 with SSE-KMS) using audited automation.

- [ ] Document **which** approach is primary vs secondary for each bucket.
- [ ] Ensure **encryption in transit and at rest** for any off-Supabase copy.

---

## 3. Signed URL verification

After backup/restore work or drill:

- [ ] From a **staging** project or restored prefix, generate a **signed URL** (or use the same code path FI Admin uses) for a **non-production** test object.
- [ ] Confirm **expiry**, **403** after expiry, and that **wrong tenant** cannot obtain URLs for another tenant’s objects (app-layer + Storage policies).
- [ ] Log one successful **read** path used in production (e.g. intake download) against the restored bucket in isolation.

---

## 4. Restore order: database vs storage

**Rule of thumb:** Restore the **database first**, or in **lockstep** with storage, so metadata (paths, tenant IDs, RLS-related keys) matches objects.

| Scenario | Guidance |
|----------|----------|
| DB restored to time **T**, Storage to **T+1h** | Risk of missing files or stale paths — avoid unless understood |
| Storage restored without DB | Orphan objects or broken links in UI |
| Full DR | **Coordinated** cutover: same logical timestamp, validation checklist, comms freeze for webhooks/cron if needed ([rollback playbook](fi-os-rollback-playbook.md)) |

- [ ] Document **order** and **timestamp alignment** in your DR run for each drill.

---

## 5. Quarterly restore drill

**Frequency:** at least **quarterly**.

- [ ] Pick a **sample tenant** (prefer **synthetic** tenant in staging; if using prod copy, see §7).
- [ ] Restore **DB** slice or full staging clone per policy, then restore **Storage prefix** for that tenant into an **isolated** staging bucket or project.
- [ ] Run **signed URL** checks (§3) and one **UI smoke** path (intake, patient image, pathology PDF, imaging media) in staging only.
- [ ] Record RTO achieved, gaps, and action items.

---

## 6. Sample tenant restore into isolated staging

- [ ] Use a **dedicated** Supabase staging project or bucket prefix **`fi-drill-{date}`** that is **not** wired to production Vercel.
- [ ] Restrict **Dashboard** and **service role** keys for drill projects to the same access list as production backups ([Supabase backup setup](fi-os-supabase-backup-setup.md) §8).
- [ ] After drill, **delete** drill artifacts or lifecycle them per retention policy.

---

## 7. Never restore production PHI into unsecured dev environments

**Hard rule:** Do not restore production buckets or DB dumps to:

- Personal laptops without full-disk encryption and contract approval
- **Public** Vercel previews or `localhost` shared screenshots
- Shared “demo” Supabase projects with **open** anon policies

- [ ] If developers need realistic shapes, use **generated** or **anonymised** datasets.
- [ ] If a prod-like staging copy is required, enforce **same** access controls as prod and **no** public URLs.

---

## Drill checklist (copy for ticket)

- [ ] Scope: buckets + tenant prefix identified  
- [ ] DB restore / clone completed or aligned timestamp  
- [ ] Storage restore completed  
- [ ] Signed URLs verified  
- [ ] Cron/webhooks paused or pointed away if drill could trigger side effects ([rollback playbook](fi-os-rollback-playbook.md))  
- [ ] Artifacts torn down or retained per policy  
- [ ] Notes filed for next quarter  
