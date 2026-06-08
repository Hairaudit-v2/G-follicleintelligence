# Production activation: IIOHR HR → FI staff sync (Evolved Perth)

Use this checklist when turning on **scheduled** and/or **outbound** IIOHR HR staff sync for production. For day-to-day operations and incident response, see **`docs/runbooks/iiohr-hr-staff-sync.md`** and **`docs/iiohr-hr-perth-staff-sync-cron.md`**.

---

## 1. Required environment variables

Set these on the **Follicle Intelligence** deployment that runs outbound sync and cron (same host as the Next.js app unless you have split workers).

| Variable | Required | Notes |
|----------|----------|--------|
| `FI_BASE_URL` | Yes | Absolute base URL of the FI app used by the outbound client to POST staff-sync (often the same deployment). |
| `IIOHR_HR_SYNC_SECRET` | Yes | Must match the value expected by `POST /api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` (header `x-iiohr-sync-secret`). |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | Yes | GET URL returning Perth HR JSON (`staff`, `rows`, or a top-level array). |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | If needed | If the feed requires auth, set this; it is sent as `Authorization: Bearer …` on the feed GET. |
| `EVOLVED_PERTH_TENANT_ID` | Yes | UUID of the Evolved Perth FI tenant that receives sync rows. |
| `CRON_SECRET` | Yes for cron | Minimum **16** characters; used as `Authorization: Bearer` for the cron route. |
| `STAFF_SYNC_STALE_WARNING_HOURS` | Optional | Staleness threshold in hours for health + admin UI (default **48** if unset). |
| `STAFF_SYNC_ALERT_EMAIL` | Optional | If set, failed or degraded cron runs emit **`[staff_sync_alert_intent]`** log lines (placeholder; no email is sent until wired). |

Optional but useful in production:

| Variable | Purpose |
|----------|---------|
| `ALLOW_EMPTY_HR_SYNC` | When `true`, an empty HR feed yields a no-op success instead of HTTP **400** on cron (no empty `rows` POST to FI). |

---

## 2. Pre-flight checks

Complete in order before enabling the scheduler.

- [ ] **Confirm tenant ID** — `EVOLVED_PERTH_TENANT_ID` equals the UUID shown in FI Admin for Evolved Perth (`fi_tenants.id`). No typos or wrong-environment UUIDs.
- [ ] **Confirm Perth clinic exists** — In Foundation for that tenant, a clinic suitable for Perth tagging exists (Staff import page may show “Perth clinic detected” when a name match is found).
- [ ] **Confirm HR feed returns rows** — `curl` or browser GET to `IIOHR_HR_PERTH_STAFF_FEED_URL` (with Bearer if required). Response must include at least one row with `external_staff_id` and `full_name` (unless you intentionally use `ALLOW_EMPTY_HR_SYNC=true`).
- [ ] **Confirm preview sync works** — FI Admin → **`/fi-admin/<tenantId>/hr/staff-import`** → **Preview FI staff sync** completes without error and shows sensible row counts.
- [ ] **Confirm commit sync works** — **Push FI staff sync** (commit) completes; `fi_staff_sync_runs` shows a successful run; FI response `ok` is true for the happy path.
- [ ] **Confirm `fi_staff_source_ids` contains `iiohr_hr` rows** — For synced people, `source_system = 'iiohr_hr'` and `source_staff_id` matches stable HR `external_staff_id` (operational bridge, not a copy of HR documents).
- [ ] **Confirm health endpoint is healthy** — `GET /api/health/iiohr-hr-staff-sync` returns `ok: true`, `stale: false`, and timestamps consistent with your test syncs (see runbook for field meanings).

---

## 3. Scheduler setup

| Item | Value |
|------|--------|
| **Endpoint** | `POST /api/cron/iiohr-hr-perth-staff-sync` |
| **Auth** | `Authorization: Bearer <CRON_SECRET>` |
| **Body** | None required (empty JSON object is fine). |

Example manual trigger:

```bash
curl -sS -X POST "https://<your-fi-host>/api/cron/iiohr-hr-perth-staff-sync" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Recommended frequency:** **Once daily**, in the **early morning Australia/Brisbane** window (e.g. 02:00–05:00 `Australia/Brisbane`) so HR exports are stable and FI load is off-peak. Adjust if HR publishes at a fixed time.

Configure the job in your platform (Vercel Cron, Kubernetes CronJob, pg_cron HTTP, etc.) with the same env vars as the app.

---

## 4. Post-activation checks

Run within the first scheduled cycle (or immediately after a manual cron POST).

- [ ] **HR Staff Import page** — **`/fi-admin/<tenantId>/hr/staff-import`**: cron health banner **success**, automation flags green where expected, no unexpected errors.
- [ ] **Recent sync runs** — Table and/or `fi_staff_sync_runs` show new runs with `metadata.trigger = 'cron'` after the schedule fires.
- [ ] **Staff directory** — **`/fi-admin/<tenantId>/staff`**: expected people visible; roles and status look correct.
- [ ] **Staff “twin” (identity bridge)** — For a sample person: `fi_staff` + `fi_users` (when email present) align with HR; `fi_staff_source_ids` row exists for `iiohr_hr` and updates on re-sync.
- [ ] **Calendar staff dropdown** — Scheduling UI lists the expected staff for the tenant/clinic after sync.
- [ ] **Health endpoint** — `GET /api/health/iiohr-hr-staff-sync` remains `ok: true` and not `stale` after the first successful cron in the window.

---

## 5. Rollback

If you need to stop automated sync quickly:

1. **Disable the scheduler** — Pause or delete the job that POSTs to `/api/cron/iiohr-hr-perth-staff-sync`.
2. **Unset feed URL or cron secret** — Remove `IIOHR_HR_PERTH_STAFF_FEED_URL` and/or `CRON_SECRET` (or rotate `CRON_SECRET` and update the scheduler) so automated runs cannot succeed until you are ready again.
3. **Manual import remains available** — CSV/JSON staff import and manual **Preview / Push FI staff sync** from the HR Staff Import page can still be used when CRM/admin access allows (see main runbook).
4. **No HR records are deleted from IIOHR** — FI rollback is about **FI operational rows and source ids**, not the IIOHR HR system of record. Do not delete HR data from IIOHR as part of FI rollback.

For data correction on FI after a bad sync, see **`docs/runbooks/iiohr-hr-staff-sync.md`** (rollback / SQL cautions).

---

## 6. Go-live signoff checklist

- [ ] All required env vars set and verified in the **production** project (not only staging).
- [ ] `EVOLVED_PERTH_TENANT_ID` matches production Evolved Perth tenant.
- [ ] `IIOHR_HR_SYNC_SECRET` matches production FI staff-sync API configuration.
- [ ] HR feed reachable from FI with expected row count.
- [ ] Preview + commit manual FI staff sync succeeded in production.
- [ ] `fi_staff_source_ids` verified for `iiohr_hr` on sample staff.
- [ ] Health endpoint green (`ok`, not `stale`).
- [ ] Scheduler configured: correct URL, Bearer `CRON_SECRET`, daily Brisbane early morning (or agreed window).
- [ ] Post-activation checks completed after first cron run.
- [ ] On-call / owner knows how to disable cron and where the runbooks live.
- [ ] (Optional) `STAFF_SYNC_ALERT_EMAIL` set and log shipping configured to capture `[staff_sync_alert_intent]` until email delivery is implemented.
