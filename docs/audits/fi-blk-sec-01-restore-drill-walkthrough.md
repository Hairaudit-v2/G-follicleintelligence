# BLK-SEC-01 — Operator walkthrough: restore drill evidence (E4–E6)

**Purpose:** Close the remaining BLK-SEC-01 evidence items after E1–E3.  
**Audience:** Platform / infra operator (Paul Green or delegate).  
**Do not execute against production.** Restore only into **isolated staging**.

**Related**

- Operator checklist §2–3: [`docs/production/evolved-p0-operator-execution-checklist.md`](../production/evolved-p0-operator-execution-checklist.md)
- DB / PITR drill: [`docs/runbooks/fi-os-supabase-backup-setup.md`](../runbooks/fi-os-supabase-backup-setup.md) §7
- Storage drill: [`docs/runbooks/fi-os-storage-backup-restore-drill.md`](../runbooks/fi-os-storage-backup-restore-drill.md)
- Evidence log: [`docs/production/evidence/backup-disaster-recovery-audit.md`](../production/evidence/backup-disaster-recovery-audit.md)
- Master ticks (E6): [`docs/runbooks/fi-os-production-hardening-master-checklist.md`](../runbooks/fi-os-production-hardening-master-checklist.md)

**Time estimate:** ~2–4 hours for a first drill (staging project setup + DB + storage + verification + teardown), shorter on subsequent quarterly drills (~1–2 hours if staging already exists).

---

## Already done — skip these (E1–E3)

| # | Item | Status | Where evidence lives |
|---|------|--------|----------------------|
| E1 | PITR enabled + retention window | ☑ 2026-06-30 | `docs/production/evidence/attachments/blk-sec-01-pitr-2026-06-30.png` |
| E2 | Daily backups / PITR mode success view | ☑ 2026-06-30 | `docs/production/evidence/attachments/blk-sec-01-daily-backups-2026-06-30.png` |
| E3 | RPO/RTO clinical/ops sign-off | ☑ 2026-06-30 | RPO 15 min / RTO 2 h — Paul Green in backup audit § RPO/RTO |

Do **not** re-screenshot PITR or re-sign RPO/RTO unless settings changed.

**Progress (2026-07-14)**

| # | Item | Status | Where evidence lives |
|---|------|--------|----------------------|
| E4 | DB restore drill into isolated staging | ☑ PASS (DB + read-only app smoke 8/8) | [`fi-security-restore-drill-1.md`](../security/fi-security-restore-drill-1.md); backup audit drill log; local gitignored JSON under `docs/security/restore-drill-evidence/` |
| E5 | Storage restore + signed URL test | ☐ Still open | Bucket metadata only; Phase C below |
| E6 | Master checklist backup/restore ticks | ☐ Blocked on E5 | Do not tick DB+Storage restore until E5 |

---

## Hard rules before you click anything

1. **Isolated staging only** — new Supabase project **or** dedicated drill project / bucket prefix `fi-drill-{YYYY-MM-DD}`. **Never** restore over the production project.
2. **Do not wire drill project to production Vercel** (storage runbook §6).
3. **No production PHI on unsecured devices** — no public Vercel previews, no personal laptops without full-disk encryption + approval, no open-anon demo projects (storage runbook §7).
4. Prefer **synthetic / anonymised** tenant data in staging; if a prod-like copy is required, enforce **same access controls as production**.
5. **Restore order:** database **first** (or lockstep with storage) so paths / tenant IDs match objects (storage runbook §4).
6. Pause or point away **cron/webhooks** if the drill environment could trigger side effects (storage drain checklist; rollback playbook).

---

## Phase A — Prep (15–30 min)

1. Confirm you are on the **authorised backup-operator** list (backup setup §8 — update names if still a template).
2. Open production Supabase only to **read backup metadata** (timestamp to restore from). Do not click Restore on the production project itself for this drill.
3. **Recovery marker (E4 prep):** PITR retention is **7 days**. Canonical production probe is `SMOKETEST-RECOVERY-MARKER-20260714` (`fi_crm_leads` `70f2e1b0-e8b7-472e-8f3e-bb59c4b92511`, created `2026-07-14T06:21:38.292Z`). Legacy `SMOKETEST-JOURNEY-001-20260630` is outside the 7-day window and is superseded for this drill. Seed/verify: `scripts/seed-blk-sec-01-recovery-marker.ts`, `scripts/verify-blk-sec-01-recovery-marker.ts`. Evidence: [`docs/production/evidence/blk-sec-01-recovery-marker-2026-07-14.md`](../production/evidence/blk-sec-01-recovery-marker-2026-07-14.md). Choose a PITR timestamp **after** the new marker and **within 7-day retention** (do not extend retention).
4. Identify:
   - **Source backup / PITR timestamp** (UTC) you will restore from (≥ marker time).
   - **Buckets:** `fi-intakes` (or env `FI_STORAGE_BUCKET_INTAKES`); optionally note `patient-images` if in scope.
   - **Sample tenant** — prefer synthetic staging tenant; if using a prod-shaped copy, restrict access immediately.
5. Create or select **isolated staging Supabase project** (blank / dedicated drill project). Name it clearly (e.g. `fi-os-drill-YYYY-MM-DD`).
6. Ensure drill service-role keys stay on the same least-privilege access list as production backups.

---

## Phase B — E4: Database restore drill

**Maps to:** Operator checklist §2 (2.1–2.3) · backup setup §7 · backup audit restore drill log.

### B1. Restore DB into staging (checklist 2.1)

1. In **Supabase Dashboard**, work from the **production** project only long enough to initiate a **restore / clone into a new (staging) project**, or use the dashboard restore flow that targets a **non-production** destination — per your plan’s backup UI ([Supabase backups docs](https://supabase.com/docs/guides/platform/backups)).
2. Choose the **known PITR / backup timestamp** recorded in prep (UTC).
3. Confirm the restore target is the **isolated staging project**, not production.
4. Wait until the staging project shows the restore as complete and SQL editor / DB is reachable.

**Capture for E4 (save as):**

| Artifact | Path |
|----------|------|
| Screenshot: staging project name + restore complete / restored-to timestamp visible | `docs/production/evidence/attachments/blk-sec-01-db-restore-staging-<YYYY-MM-DD>.png` |
| Optional: CLI/dashboard log excerpt (redact secrets) | `docs/production/evidence/attachments/blk-sec-01-db-restore-log-<YYYY-MM-DD>.txt` |

**Screenshot must show:** isolated staging project identity + successful restore (or clone) + **source/restore timestamp**. Must **not** look like a production cutover.

### B2. Sample row counts / non-PHI checksum (checklist 2.2)

In **staging** SQL editor (not production), run verification suitable for your restore (examples — adjust table names to what exists after restore; prefer **counts / aggregates**, not PHI columns):

```sql
-- Non-PHI shape checks (edit tables as needed for your schema)
SELECT 'fi_users' AS table_name, count(*) AS n FROM public.fi_users
UNION ALL
SELECT 'fi_cases', count(*) FROM public.fi_cases
UNION ALL
SELECT 'fi_staff', count(*) FROM public.fi_staff;
```

Paste **redacted** output into the drill log (see Phase D). Optionally save:

`docs/production/evidence/attachments/blk-sec-01-db-rowcounts-<YYYY-MM-DD>.txt`

**E4 credibility:** numbers from the **staging** DB after restore; no patient names, emails, or clinical notes in the paste.

### B3. Auth linkage spot-check (checklist 2.3)

Confirm `auth.users` was in restore scope (backup setup §5). In **staging**:

```sql
-- Spot-check: app users linked to Auth (no emails in export)
SELECT
  count(*) FILTER (WHERE auth_user_id IS NOT NULL) AS linked,
  count(*) FILTER (WHERE auth_user_id IS NULL) AS unlinked,
  count(*) AS total
FROM public.fi_users;

-- Optional: orphan check (rows pointing at missing auth users)
SELECT count(*) AS orphaned_fi_users
FROM public.fi_users u
LEFT JOIN auth.users a ON a.id = u.auth_user_id
WHERE u.auth_user_id IS NOT NULL AND a.id IS NULL;
```

Record Pass/Fail under drill log **§ auth linkage**. Orphan count > 0 → note gap; do not “fix” production Auth.

**Capture (optional but strong):**

`docs/production/evidence/attachments/blk-sec-01-auth-linkage-<YYYY-MM-DD>.txt`

---

## Phase C — E5: Storage restore + signed URL

**Maps to:** Operator checklist §3 (3.1–3.3) · storage restore drill §3–7.

### C1. Align timestamp and restore storage (checklist 3.1)

1. Restore **`fi-intakes`** (or `FI_STORAGE_BUCKET_INTAKES`) into the **staging** project / prefix at a timestamp **aligned** with the DB restore (storage runbook §4 — avoid DB at T and Storage at T+1h unless understood).
2. Prefer bucket or prefix `fi-drill-{YYYY-MM-DD}` that is **not** used by production Vercel.
3. Scope to a **sample tenant prefix** when possible (storage runbook §5).

**Capture:**

`docs/production/evidence/attachments/blk-sec-01-storage-restore-staging-<YYYY-MM-DD>.png`

**Must show:** staging destination + bucket/prefix + restore alignment (timestamp or note tying to DB restore time).

### C2. Signed URL read test (checklist 3.2)

From **staging** (Dashboard signed URL, or same code path FI Admin uses against **staging** keys only):

1. Generate a signed URL for a **non-production / drill** test object under the restored prefix.
2. Perform one successful **HTTP GET** (curl or browser) while the URL is valid.
3. Optionally confirm **403/expiry** after TTL and that wrong-tenant URLs fail (storage runbook §3).

**Save curl/log (redact full URLs if they embed long tokens; keep status codes + object key):**

`docs/production/evidence/attachments/blk-sec-01-signed-url-test-<YYYY-MM-DD>.txt`

**E5 credibility:** one successful **read** against the **restored staging** bucket/prefix; explicit Pass in the drill log.

### C3. PHI attestation (checklist 3.3)

In the drill log, operator attests: **no production PHI restored to unsecured dev** (storage runbook §7). Initial + date.

---

## Phase D — Fill the evidence log (E4 + E5 closure)

Edit [`docs/production/evidence/backup-disaster-recovery-audit.md`](../production/evidence/backup-disaster-recovery-audit.md):

1. Fill **§ Restore drill log (template)** — every field:

| Field | What to enter |
|-------|----------------|
| Operator | Your name |
| Date (UTC) | Drill date |
| Environment | `Isolated staging only` (+ staging project name) |
| Source backup timestamp | PITR/backup UTC used |
| DB restore result | ☐ → ☑ Pass (or Fail + notes) |
| Row count / checksum sample | Paste SQL summary (non-PHI) |
| Storage bucket restored | e.g. `fi-intakes` → staging prefix |
| Signed URL read test | ☐ → ☑ Pass |
| Verifier | Second person initials + date |

2. Add a short **§ auth linkage** note under or beside the log (Pass/Fail + orphan count).
3. Mark Evidence Closure Checklist **E4** and **E5** Complete with owner + date.
4. Update executive summary rows for “DB restore drill” / “Storage restore drill” to **Yes** with artifact paths.
5. Tick operator checklist §2 and §3 rows in `evolved-p0-operator-execution-checklist.md`.

**Suggested attachment naming (all under `docs/production/evidence/attachments/`):**

```text
blk-sec-01-db-restore-staging-<YYYY-MM-DD>.png
blk-sec-01-db-restore-log-<YYYY-MM-DD>.txt          # optional
blk-sec-01-db-rowcounts-<YYYY-MM-DD>.txt
blk-sec-01-auth-linkage-<YYYY-MM-DD>.txt             # optional
blk-sec-01-storage-restore-staging-<YYYY-MM-DD>.png
blk-sec-01-signed-url-test-<YYYY-MM-DD>.txt
```

---

## Phase E — E6: Master hardening checklist ticks

1. Open [`docs/runbooks/fi-os-production-hardening-master-checklist.md`](../runbooks/fi-os-production-hardening-master-checklist.md).
2. Under **Must fix before production**, mark complete (when true):
   - **Backup / PITR setup** — already backed by E1–E3; tick after confirming §1–§3 of backup setup are reflected in evidence (PITR, daily/PITR view, RPO/RTO). Remaining policy items (service role rotation acknowledgement, access list names, pre-migration rule) — complete or note Accepted risk separately; do not invent ticks.
   - **DB + Storage restore drill** — tick only after E4 + E5 artifacts exist.
3. Under **Manual setup — Supabase**, tick when done:
   - **Storage policies** / restore drill reference (if policies already OK, tick with note pointing at drill).
   - **Database backups / PITR** tier + retention — consistent with E1–E2.
4. In the backup audit, mark **E6** Complete and link: `docs/runbooks/fi-os-production-hardening-master-checklist.md` (optionally attach a dated export/screenshot of the ticked section as `attachments/blk-sec-01-master-checklist-<YYYY-MM-DD>.png`).
5. Update P0 closure summary: BLK-SEC-01 → **Complete** only when E1–E6 are done with verifier initials (or formally **Accepted risk** with clinic lead).

---

## Phase F — Teardown (required)

1. Delete drill artifacts / lifecycle staging bucket prefix per retention policy (storage runbook §6).
2. Disable or delete the drill Supabase project if it was purpose-built, **or** wipe PHI-bearing data from shared staging.
3. Confirm no production Vercel env still points at drill keys.
4. File “next quarterly” reminder (backup setup §7 — at least quarterly).

---

## Definition of done (what each E must prove)

| Evidence | Must prove |
|----------|------------|
| **E4** | Production DB backup/PITR point restored into **isolated staging**; timestamp recorded; sample non-PHI counts/checksum; `auth.users` ↔ `fi_users.auth_user_id` spot-check logged |
| **E5** | `fi-intakes` (or configured intakes bucket) restored to staging at aligned time; signed URL **read** succeeds; operator attests no PHI dumped to unsecured dev |
| **E6** | Master checklist backup/PITR + DB+storage restore drill items ticked, with link/export referenced from backup audit |

---

## Copy-paste ticket checklist

From storage runbook “Drill checklist”:

- [ ] Scope: buckets + tenant prefix identified  
- [ ] DB restore / clone completed or aligned timestamp (**staging only**)  
- [ ] Storage restore completed  
- [ ] Signed URLs verified  
- [ ] Cron/webhooks paused or pointed away if drill could trigger side effects  
- [ ] Artifacts torn down or retained per policy  
- [ ] Drill log filled in `backup-disaster-recovery-audit.md`  
- [ ] Attachments under `docs/production/evidence/attachments/`  
- [ ] Master checklist backup ticks (E6)  
- [ ] Notes filed for next quarter  
