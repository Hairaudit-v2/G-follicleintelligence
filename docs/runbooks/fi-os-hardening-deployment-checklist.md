# FI OS — Hardening & Digital Twin foundation — deployment checklist

**Purpose:** Ship **recent hardening** (RLS, Stripe idempotency, machine-ingest HMAC) and **Digital Twin / network subjects** schema safely across **dev → staging → production**. This document does **not** add product features; it is operational only.

**Related:** [Supabase migration push / remote map](supabase-follicle-intelligence-migration-push.md) · [Rollback playbook](fi-os-rollback-playbook.md) · [Machine ingest HMAC](fi-os-machine-ingest-hmac-runbook.md) · [Payment webhook idempotency](../security/payment-webhook-idempotency.md) · [Architecture — digital twin foundation](../architecture/digital-twin-foundation-design.md)

---

## 1. How Supabase expects migration history

- Applied migrations are recorded in Postgres schema **`supabase_migrations`** table **`schema_migrations`** (CLI and hosted projects use this convention).
- Each row’s **`version`** matches the **numeric prefix** of the migration filename: for file `20260820120001_fi_machine_ingest_hmac.sql`, the version key is **`20260820120001`** (not the slug).
- The CLI compares **files in `supabase/migrations/*.sql`** (sorted by version) to **`schema_migrations`**. Anything **on the server but missing as a file** (or **vice versa**) shows up in `migration list` and can block `db push` until reconciled.
- **Ordering:** Two files must not share the same version prefix. Timestamps determine apply order.
- **Repair:** When the live schema already matches a migration’s intent but history is wrong (for example after a **rename**), use `npx supabase migration repair` with the appropriate `--status` after reading `npx supabase migration repair --help` and confirming with engineering. Wrong repair can skip needed DDL or mark broken states as applied.

---

## 2. Renamed or re-timestamped migrations — conflict risk with hosted DB

Before **any** linked push, compare `npx supabase migration list --linked` (staging/prod) to filenames in `supabase/migrations/`. Pay special attention to the following **known** rename / retimestamp situations.

### 2a. Documented historical renames (already in git history)

| Situation | Old version / file | Current repo file | Risk if hosted DB recorded the **old** version |
|-----------|--------------------|-------------------|-----------------------------------------------|
| Imaging OS timestamp | `20260612140001_fi_imaging_os.sql` | `20260624130001_fi_imaging_os.sql` | Remote row **`20260612140001`** with no matching local file → list mismatch. Use repair / manual reconciliation per [migration push runbook](supabase-follicle-intelligence-migration-push.md) §1–§4. |
| HIE stage 9c duplicate version fix | `20260813120001_hie_stage9c_donor_intelligence.sql` | `20260813120002_hie_stage9c_donor_intelligence.sql` | If any database applied **stage 9c** under the **old** `20260813120001` version string, history conflicts with the **stage 9b** file that now owns `20260813120001`. Reconcile before push. |

### 2b. Staff metadata / feature-access audit — **re-timestamp in current branch**

Tracked names were **`20260612120002_fi_staff_staff_metadata.sql`** and **`20260612130001_fi_staff_feature_access_audit_events.sql`**. The working tree may replace these with **`20260624120002_*`** and **`20260704120002_*`** (same logical migrations, new version prefixes).

| If hosted `schema_migrations` contains… | And repo only has… | Risk |
|----------------------------------------|-------------------|------|
| `20260612120002` | `20260624120002_...` (no `20260612120002` file) | CLI reports missing local migration for an applied version, or ordering/history confusion. |
| `20260612130001` | `20260704120002_...` | Same. |
| Neither row (migrations never applied) | New files only | **Low** — push applies the new version keys only. Confirm with `migration list --linked`. |

**Action:** For each environment, run **`npx supabase migration list --linked`** and resolve **yellow/red** or “remote only” rows before production. Do not assume staging matches prod.

### 2c. This release’s **new** SQL migrations (verify not already applied under another name)

Confirm these appear once in git and match remote after push:

- `20260818120002_fi_cases_tenant_select_rls.sql`
- `20260818120003_fi_payments_stripe_intent_unique.sql` — **fails** if duplicate `(tenant_id, stripe payment intent)` rows exist; dedupe first (see [payment webhook idempotency](../security/payment-webhook-idempotency.md)).
- `20260820120001_fi_machine_ingest_hmac.sql`
- `20260821120001_fi_network_subjects_foundation.sql`
- `20260821120002_fi_network_subjects_foundation_integrity.sql`

---

## 3. Environment checklist (dev → staging → prod)

Use the same sequence per environment; **prod** adds stricter gates.

### 3.1 Dev (local Supabase)

- [ ] Branch matches intended release; `git status` clean for migration folder (no accidental duplicate version prefixes).
- [ ] `npx supabase start` healthy (`npx supabase status`).
- [ ] Migrations applied locally (`migration up` or `db reset` per §4).
- [ ] §5–§7 commands green.
- [ ] Optional: `npm run smoke:network-subjects` (destructive — resets local DB; see §5).

### 3.2 Staging (linked Supabase project)

- [ ] Backup or confirm staging is disposable / restorable.
- [ ] `npx supabase link --project-ref <staging_ref>` (if not already linked); database password available for CLI.
- [ ] `npx supabase migration list --linked` reviewed; §2 conflicts resolved.
- [ ] `npx supabase db push --linked --dry-run` then `db push --linked` in a window (see §4).
- [ ] §5–§7 against **staging** app URL / env where relevant.
- [ ] Smoke SQL if you maintain a staging DB that mirrors local Docker workflow (usually `smoke:network-subjects:only` **only** if Docker points at staging — not typical; prefer staging-specific SQL checks or app smoke).

### 3.3 Production

- [ ] **Change window** agreed; [rollback playbook](fi-os-rollback-playbook.md) owner identified.
- [ ] **No automatic prod migration** from this repo or CI without human `migration list` + `db push --dry-run` review (see policy §8).
- [ ] Supabase **backup / PITR** awareness ([backup setup](fi-os-supabase-backup-setup.md)).
- [ ] **Pre-push:** duplicate Stripe PaymentIntent rows checked; RLS change impact reviewed for support tooling (service role vs anon/authenticated).
- [ ] **`FI_MACHINE_INGEST_MASTER_KEY`** and other new env vars set **before** or **with** code deploy per [machine ingest runbook](fi-os-machine-ingest-hmac-runbook.md) and [env audit](fi-os-env-vars-production-audit.md).
- [ ] After DB push: deploy app; verify webhooks/cron; run targeted prod smoke (`npm run smoke:prod` if part of your process).

---

## 4. Exact commands — Supabase migrations

Run from **repository root** (`follicleintelligence`). The repo pins Supabase CLI via `npx supabase`.

**Linked remote (staging/prod):** set the **database password** when the CLI asks, **or** export it first. Many commands (`migration list --linked`, `db push --linked`) need it so the CLI can connect **without** relying on the short-lived **login role** Management API flow.

```powershell
# PowerShell — password from Supabase Dashboard → Project Settings → Database
$env:SUPABASE_DB_PASSWORD = "<database password for the postgres role>"
```

### Check migration status (local containers)

```bash
npx supabase migration list
```

### Check migration status (linked remote project)

```bash
npx supabase link --project-ref <project_ref>
npx supabase migration list --linked
```

### Troubleshooting — `Initialising login role...` / `403` / “necessary privileges”

The CLI calls Supabase’s **Management API** to create a temporary **`cli/login-role`** connection. A **`403`** with *Your account does not have the necessary privileges to access this endpoint* usually means one or more of:

1. **Use the database password (recommended first step)** — Set `SUPABASE_DB_PASSWORD` (see above) **before** `migration list` / `db push`, then retry. That path often **skips** login-role creation. If the project was linked without the password, run `npx supabase link --project-ref <project_ref>` again with the env var set so local link state stores a working connection.

2. **Org / project role** — Your Supabase login must have permission to manage that project (see [Supabase access control](https://supabase.com/docs/guides/platform/access-control)). If you were only invited with a read-only or non-developer role, ask an **Owner** to raise your role or run migrations from an account that already has access.

3. **Refresh auth** — Run `npx supabase login` again. If your org uses PATs, create a token under **Account → Access tokens** and set `SUPABASE_ACCESS_TOKEN`, then retry `link` / `migration list`.

4. **Pooler / IPv6 edge cases** — If linking keeps failing on login role, try `npx supabase link --project-ref <project_ref> --skip-pooler` (direct DB; IPv6 may be required depending on region). See Supabase CLI discussions for “login role” and “skip pooler”.

If nothing works, you can still inspect remote history in the **SQL Editor** (`select * from supabase_migrations.schema_migrations order by version`) using the dashboard, then align with `migration repair` only under engineering guidance.

### Apply migrations — **local** dev database

Incremental (applies pending migrations to local Supabase):

```bash
npm run supabase:migration:up
```

Equivalent:

```bash
npx supabase migration up
```

Full local rebuild from all migrations + seeds (destructive):

```bash
npm run supabase:db:reset
```

### Apply migrations — **staging / prod** (human-operated)

**Do not** run production push without dry-run and review.

```bash
npx supabase db push --linked --dry-run
```

If the CLI skips expected files due to ordering, only use when engineering confirms:

```bash
npx supabase db push --linked --dry-run --include-all
```

Apply after approval:

```bash
npx supabase db push --linked --yes
```

**Production:** execute **`db push --linked`** only in an approved window, after §3.3 checklist and §9 stop conditions cleared.

---

## 5. Exact commands — network subjects smoke

**Full** smoke (resets **local** Supabase DB, reapplies all migrations from scratch, then runs smoke SQL via Docker):

```bash
npm run smoke:network-subjects
```

**Smoke SQL only** (local `supabase_db_*` container must be running; does **not** reset DB):

```bash
npm run smoke:network-subjects:only
```

Implementation: `scripts/run-supabase-sql-docker.mjs` + `supabase/smoke/fi_network_subjects_foundation_smoke.sql`.

---

## 6. Exact commands — payment idempotency tests

Runs the **Stage 7f** tests that import `stripeWebhookIdempotency` (covers webhook + PaymentIntent idempotency behaviour):

```bash
npx tsx --test src/lib/revenueOs/revenueOsPaymentsStage7f.test.ts
```

---

## 7. Exact commands — machine ingest HMAC tests

```bash
npx tsx --test src/lib/fi/machineIngest/machineIngestCanonical.test.ts src/lib/fi/machineIngest/machineIngestHmacVerify.test.ts
```

---

## 8. Exact commands — typecheck and lint

```bash
npm run typecheck
npm run lint
```

Optional formatting gate (if your pipeline uses it):

```bash
npm run format:check
```

---

## 9. Rollback and stop conditions

### Stop — do **not** push migrations until resolved

- **`migration list --linked`** shows versions **applied on remote** with **no matching file** in `supabase/migrations/` (often caused by §2 renames).
- **`db push --dry-run`** reports errors on **`20260818120003`** — indicates duplicate Stripe PaymentIntent rows; dedupe per [payment idempotency](../security/payment-webhook-idempotency.md) before retrying.
- **RLS migration** (`20260818120002`) would block legitimate **authenticated** workflows you cannot list and test.
- **Machine ingest migration** would run but **app** returns **503** for ingest if `FI_MACHINE_INGEST_MASTER_KEY` is missing or invalid in production — hold traffic or deploy env **with** migration.

### Stop — do **not** promote app deploy

- `npm run typecheck` or `npm run lint` fails on the release commit.
- Payment or machine-ingest **tests** in §6–§7 fail.

### Rollback (high level)

- **App:** Vercel instant rollback to last known-good deployment; see [rollback playbook](fi-os-rollback-playbook.md) §1.
- **Database:** Prefer **forward fix** (new migration) when schema and data remain valid; **do not** hand-edit prod to “undo” migrations. **PITR / restore** only with runbook §2 and leadership approval.
- **Cron / webhooks:** pause if app and DB are inconsistent ([rollback playbook](fi-os-rollback-playbook.md) §4).

---

## 10. Policy — production migrations

- **Never** run `npx supabase db push --linked` against **production** from automation (CI, scripts, or agent) without an explicit human approval step in your change process.
- A human must run **`migration list --linked`**, **`db push --linked --dry-run`**, and only then **`db push --linked --yes`** in the production project, in that order, unless your organisation’s stricter DBA process replaces this.

---

## 11. Post-deploy verification (minimal)

- [ ] `npx supabase migration list --linked` — all expected versions applied; no unexpected “remote only” rows.
- [ ] Stripe webhook: replay a test event in Stripe Dashboard **twice** — second delivery should be treated as duplicate where applicable (see security doc).
- [ ] Signed machine ingest: negative test (bad signature) and positive test in non-prod before prod keys live.
- [ ] FI OS case list / tenant-scoped queries still work for a normal staff session (RLS).

---

## Document control

- **Created for:** FI OS hardening + Digital Twin foundation deployment prep.
- **Refresh when:** New migrations ship or Supabase CLI default flags change.
