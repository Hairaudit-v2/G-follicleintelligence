# FI OS — Production release checklist

**Purpose:** Ordered flow to promote FI OS to production with **env validation**, **tests**, **migration awareness**, **platform checks**, **automated smoke**, and **manual PHI-bearing verification**.  
**Related:** [Production readiness](fi-os-production-readiness.md) · [Rollback playbook](fi-os-rollback-playbook.md) · [Supabase backup / PITR](fi-os-supabase-backup-setup.md) · [Master checklist](fi-os-production-hardening-master-checklist.md)

---

## Ordered release flow

Complete **in order** unless your CI already covers a step (then cite pipeline run URL in the sign-off table).

| Step | Action | Notes |
|-----:|--------|--------|
| 1 | **Git clean** | Working tree matches intended release: `git status` clean for tracked changes; branch/tag = promoted SHA. *Do not use destructive `git clean -fdx` unless team policy explicitly requires it and you understand loss of untracked files.* |
| 2 | **`pnpm install`** | From repo root; lockfile committed. |
| 3 | **`pnpm run check:env`** | Use **production-like** env (local `.env.production.local` mirroring Vercel names, or CI secret set). See [`src/lib/env/fiEnv.server.ts`](../../src/lib/env/fiEnv.server.ts). |
| 4 | **`pnpm run test:unit`** | Zero failures before promote. |
| 5 | **`pnpm exec next lint`** | No errors (warnings per team policy). |
| 6 | **`npx tsc --noEmit`** | Full project typecheck. |
| 7 | **Confirm migrations** | Production (or target DB) has applied all migrations the release expects — `supabase migration list` / dashboard history; see [production readiness §2](fi-os-production-readiness.md). |
| 8 | **Confirm Vercel env vars** | Names and values for production; no secrets in `NEXT_PUBLIC_*`. Cross-check [env audit](fi-os-env-vars-production-audit.md). |
| 9 | **Confirm Supabase backups / PITR active** | Per [Supabase backup setup](fi-os-supabase-backup-setup.md): last backup OK, PITR on if licensed. |
| 10 | **Deploy** | Vercel production promote or merge-to-main per your branching model. |
| 11 | **`pnpm run smoke:prod`** | **Post-deploy.** Requires `FI_BASE_URL` and production-reachable URL; optional `FI_SMOKE_TENANT_ID`. Script: [`scripts/fi-production-smoke-test.ts`](../../scripts/fi-production-smoke-test.ts). See §Post-deploy smoke below. |
| 12 | **Manual verification** | Login, CRM, calendar, patient twin, pathology, imaging, reminders (§Manual test matrix). |

---

## Exact command sequence (release machine / CI)

Run from repository root after checkout of the **release SHA**:

```bash
git status
pnpm install
pnpm run check:env
pnpm run test:unit
pnpm exec next lint
npx tsc --noEmit
```

After **deploy** (Vercel / hosting), with production-like env for smoke (including `FI_BASE_URL` pointing at production):

```bash
pnpm run smoke:prod
```

---

## Post-deploy smoke (`pnpm run smoke:prod`)

- [ ] Configure secrets per [`docs/runbooks/fi-os-production-readiness.md`](fi-os-production-readiness.md) § deployment blockers (smoke / cron / webhooks).
- [ ] Run `pnpm run smoke:prod` and archive **stdout** in the change ticket.
- [ ] Investigate any **failure** before declaring release complete; use [rollback playbook](fi-os-rollback-playbook.md) if smoke indicates broken auth or exposed endpoints.

---

## Manual test matrix (PHI-aware)

Perform in **production** only with authorised accounts; avoid sharing patient identifiers in tickets.

- [ ] **Login** — FI Admin; patient portal if enabled.
- [ ] **CRM** — lead list, stage change or note (role-appropriate).
- [ ] **Calendar** — agenda loads; create or move test booking if policy allows.
- [ ] **Patient twin** — open twin view; media buckets load without 500.
- [ ] **Pathology** — list / detail; PDF path if in scope.
- [ ] **Imaging** — open imaging UI; verify media/signed path behaviour.
- [ ] **Reminders** — enqueue or verify cron path in **staging first** if live delivery is risky; in prod follow [cron audit](fi-os-cron-production-audit.md) hygiene.

---

## Sign-off table

| Step | Owner | Timestamp (UTC) | Evidence (link / note) |
|------|-------|-----------------|-------------------------|
| `check:env` | | | |
| `test:unit` | | | |
| `next lint` | | | |
| `tsc --noEmit` | | | |
| Migrations confirmed | | | |
| Vercel env confirmed | | | |
| Backups / PITR confirmed | | | |
| Deploy completed | | | |
| `smoke:prod` | | | |
| Manual matrix | | | |
| **Release approved** | | | |
