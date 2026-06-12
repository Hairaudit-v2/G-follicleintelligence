# FI OS — Rollback playbook

**Purpose:** Standard responses when a production release must be **reverted** or when **migrations / jobs** threaten data integrity or duplicate patient communications.  
**Related:** [Production release checklist](fi-os-production-release-checklist.md) · [Backup & recovery](fi-os-backup-recovery-production.md) · [Supabase backup / PITR](fi-os-supabase-backup-setup.md) · [Storage restore drill](fi-os-storage-backup-restore-drill.md) · [Cron audit](fi-os-cron-production-audit.md) · [Webhooks audit](fi-os-webhook-production-audit.md)

---

## Rollback decision tree

Use this **order**:

1. **Is the app broken for most users (500s, auth down, data corruption visible)?**  
   - **Yes →** Immediate **Vercel rollback** to last known-good deployment (§1). Parallel: assess if **cron/webhooks** must pause (§4).  
   - **No →** Go to 2.

2. **Is the database schema ahead of what the rolled-back app expects (migrations already applied)?**  
   - **Yes →** Prefer **forward fix** (new deploy) if safe; **do not** hand-edit prod tables to “undo” migrations. If incompatible, plan **PITR / restore** (§2) with leadership approval.  
   - **No →** App-only rollback is usually sufficient.

3. **Did Storage or external integrations already process bad side effects (duplicate emails/SMS, wrong files)?**  
   - **Yes →** Pause jobs (§4); follow comms / clinical ops procedure; Storage may need **selective** restore or manual correction — coordinate with §5.

4. **Is PHI exposure suspected?**  
   - **Yes →** Invoke **incident / breach** process; freeze credentials; rotate secrets; preserve logs. Outside the scope of this doc’s mechanics.

---

## 1. App rollback through Vercel (previous deployment)

- [ ] In Vercel → Project → **Deployments**, identify the **last known-good** deployment.
- [ ] **Instant Rollback** / promote previous production deployment (per Vercel UI).
- [ ] Verify **`NEXT_PUBLIC_*`** and server env still match the rolled-back build’s expectations.
- [ ] Re-run **`pnpm run smoke:prod`** against production URL after rollback.
- [ ] **Caution:** If production DB received **migrations** the old app does not support, rollback can **worsen** errors — see §2.

---

## 2. Database rollback — PITR / restore only

**Rule:** **Do not** “rollback” the database by **manual table edits** or ad-hoc DELETE/UPDATE to mimic a down migration.

- [ ] **Preferred:** Restore from **Supabase PITR** or **managed backup** to a timestamp **before** the bad change, into a **new** project or isolated instance first if possible.
- [ ] Validate restored data + **`auth.users`** alignment + app connectivity **before** cutover.
- [ ] **Breaking migrations:** prevention is **expand/contract** in dev/staging ([backup & recovery](fi-os-backup-recovery-production.md) §5); production recovery is restore-time-based, not guessed SQL.

---

## 3. Migration failure process

| Phase | Action |
|-------|--------|
| **During apply** | Stop further steps; capture error + migration version; notify owner on call. |
| **If partially applied** | Do **not** assume state; inspect Supabase migration history + logs; consult engineering lead. |
| **Forward path** | Fix-forward migration **only** if schema matches and app is safe; else restore + replan. |
| **Communication** | Update status page / internal channel; pause dependent releases. |

---

## 4. Webhook / cron pause procedure

To prevent **duplicate processing** or writes while DB/app is inconsistent:

- [ ] **Vercel cron:** disable or reschedule jobs in Vercel (reminder jobs, HR staff sync) per [cron audit](fi-os-cron-production-audit.md).
- [ ] **External schedulers (Zapier, etc.):** pause Timely or other webhooks at source if duplicates risk patient updates ([webhooks audit](fi-os-webhook-production-audit.md)).
- [ ] **Document** pause start/end time and who re-enabled.

---

## 5. Reminder duplicate-send caution

Restoring the DB to an **older** timestamp or replaying queues can cause **duplicate** patient communications if:

- Outbound provider (Resend/Twilio) already sent at **newer** wall time, or  
- Cron re-processes rows that look “pending” again.

- [ ] Coordinate with **clinical ops** before restore cutover.
- [ ] Consider **idempotency** / job state tables when designing recovery (longer-term hardening).

---

## 6. Storage restore considerations

- [ ] Align Storage restore **timestamp** with DB ([storage drill](fi-os-storage-backup-restore-drill.md)).
- [ ] After partial Storage restore, verify **signed URLs** and missing-object handling in UI.
- [ ] Do not restore production PHI to unsecured environments.

---

## 7. Who approves rollback

| Severity | Approver (example — set names in your org) |
|----------|---------------------------------------------|
| App-only rollback, no data restore | **Engineering on-call** or release manager |
| DB PITR / full restore | **Engineering lead** + **Clinical / operations** + **Security/compliance** as required |
| Suspected breach or wide PHI impact | **Executive + legal** per incident policy |

Record approver names in the change / incident ticket.

---

## Quick reference

| Layer | Rollback method |
|-------|-----------------|
| **Vercel app** | Promote previous deployment |
| **Postgres** | PITR / backup restore — **not** manual table surgery |
| **Storage** | Coordinated restore with DB; verify signed URLs |
| **Jobs** | Pause cron + external webhooks during inconsistent state |
