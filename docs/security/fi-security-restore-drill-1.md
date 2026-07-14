# FI-SECURITY-RESTORE-DRILL-1 findings

Use this template after the restore is completed into a new isolated Supabase project. Do not record secrets, PHI values, or signed URL tokens.

## Drill metadata

| Field | Value |
| --- | --- |
| Operator | thelo |
| Verifier |  |
| Date (UTC) | 2026-07-14 |
| Source production project ref | `iqqvzgxoimxchhcnbzxl` |
| Restored project ref | `jzphojhurhguitfuuizo` |
| Environment | Isolated staging only |
| Backup type | Physical backup / PITR |
| Retention | 7 days (PITR; E1 evidence 2026-06-30) |
| Selected recovery point (UTC) | Not recorded in validator env (`recoveryPointUtc` null) — must be after marker `2026-07-14T06:21:38.292Z` |
| Restore request time (UTC) | `2026-07-14T08:01:01.479521Z` |
| Database available time (UTC) | Not recorded in validator env (`databaseAvailableAtUtc` null); DB validator PASS by `2026-07-14T08:17:59.643Z` |
| Application validated time (UTC) | `2026-07-14T09:37:18.138Z` |
| Measured RPO | Marker present in restore (`SMOKETEST-RECOVERY-MARKER-20260714`, created `2026-07-14T06:21:38.292185+00:00`) — exact selected PITR timestamp not captured |
| Database RTO | Restore request `08:01:01Z` → DB validator PASS `08:17:59Z` (~17 min evidenced tooling window; dashboard available time not recorded) |
| Operational RTO | Restore request `08:01:01Z` → app validated `09:37:18Z` (~1 h 36 min) — within signed 2 h RTO |

## Database validation

| Check | Result | Evidence |
| --- | --- | --- |
| Production project refused by tooling | PASS | Validator fail-closed check |
| Connected restored project ref matches expected | PASS | `jzphojhurhguitfuuizo`; evidence JSON |
| Evolved tenant present | PASS | Tenant count 4; protected tenant present |
| Pre-recovery marker present | PASS | `SMOKETEST-RECOVERY-MARKER-20260714`; evidence JSON |
| Post-recovery marker absent before authorised mutation | PASS | Post marker absent; evidence JSON |
| Critical table counts captured | PASS | 17/17 counted by validator |
| Representative IDs validated | PASS | No optional representative IDs supplied |
| Auth identities intact | PENDING | Dedicated `auth.users` ↔ `fi_users.auth_user_id` orphan SQL not yet attached; staff mapping 11/11 linked `fi_users`→`fi_staff` PASS |
| Staff mappings intact | PASS | `fi_staff` 22; linked operators 11/11 mapped; access grants 21 |
| Access grants intact | PASS | `fi_staff_access_grants` 21 |
| Migration history captured | PASS | Verified out-of-band by read-only SQL (`FI_DRILL_MIGRATION_HISTORY_OUT_OF_BAND=YES`) |

## Critical table results

Paste non-PHI counts only.

| Table | Count | Notes |
| --- | ---: | --- |
| `fi_tenants` | 4 | Non-PHI count |
| `fi_users` | 20 | Tenant-scoped non-PHI count |
| `fi_staff` | 22 | Tenant-scoped non-PHI count |
| `fi_staff_access_grants` | 21 | Non-PHI count |
| `fi_persons` | 4856 | Tenant-scoped non-PHI count |
| `fi_patients` | 824 | Tenant-scoped non-PHI count |
| `fi_crm_leads` | 4706 | Tenant-scoped non-PHI count |
| `fi_bookings` | 18 | Tenant-scoped non-PHI count |
| `fi_consultations` | 10 | Tenant-scoped non-PHI count |
| `fi_cases` | 12 | Tenant-scoped non-PHI count |
| `fi_payment_records` | 8 | Tenant-scoped non-PHI count |
| `fi_patient_images` | 2 | Tenant-scoped non-PHI count |
| `fi_pathology_requests` | 0 | Non-PHI count |
| `fi_audits` | 0 | Non-PHI count |

**DB evidence (local, gitignored):** `docs/security/restore-drill-evidence/restored-database-jzphojhurhguitfuuizo-2026-07-14T08-17-59-645Z.json` (verdict PASS).

## Application validation

Read-only operational-day smoke against restored staging app (`FI_BASE_URL=http://localhost:3000`, tenant `c2615b95-b707-4485-aa5f-be8f78ec868a`). Live integrations forced off by drill harness.

| Surface | Result | Evidence |
| --- | --- | --- |
| Today | PASS (HTTP/loader scope) | Reception board unauth redirect + auth API payload; loader_tier |
| Front Desk | PASS (HTTP/loader scope) | `http_reception_board_*` + loaders (2 appointments) |
| Pipeline | NOT RUN | Journey / CRM pipeline UI not in this read-only smoke |
| Patients | NOT RUN | Patients hub not asserted in this run |
| Calendar | PASS (feed scope) | Operational feed loader: `feedItems=2`; calendar feed budget met |
| Consultations | NOT RUN | Consult hub not asserted in this run |
| Money | NOT RUN | Money surfaces not asserted; payments disabled for drill |
| Team / staff mapping | PASS | `staff_mapping_audit` — all linked operators have `fi_staff` + access signal |
| Case / readiness surface | NOT RUN | Surgery readiness board not asserted in this run |
| Recovery-only mutation | SKIPPED | `journey_tier` requires `--execute`; not run |
| Hard reload persistence | SKIPPED | Requires mutation journey |
| Mutation reverted | SKIPPED | Requires mutation journey |

**App evidence (local, gitignored):** `docs/security/restore-drill-evidence/restored-application-jzphojhurhguitfuuizo-2026-07-14T09-37-18-138Z.json` (verdict PASS).  
**Report:** `docs/fi-os-operational-readiness-report.md` — **8/8 passed, 0 failed** (`Generated: 2026-07-14T09:37:18.046Z`). Includes `http_reception_board_api_auth` PASS after host/process `FI_ADMIN_API_KEY` alignment (harness note on main `e3a32f72`).

## Storage validation

Database restore does not prove Storage binary recovery. Record separate Storage restore evidence here.

| Check | Result | Evidence |
| --- | --- | --- |
| Bucket metadata inventoried | PASS | DB validator `storage_bucket_metadata_inventory` — 4 buckets (`hli-intakes`, `patient-images`, `tenant-branding`, `fi-financial-documents`); non-public |
| Critical object classes identified | PENDING | Intakes / patient images / financial docs named in plan; no drill copy scope recorded |
| Storage restore/copy target isolated | PENDING | No Storage restore/copy into drill prefix evidenced |
| Signed URL read succeeded | PENDING | No signed-URL artifact |
| Signed token redacted from evidence | PENDING | N/A until signed-URL test exists |
| Expiry / wrong-tenant behavior checked | PENDING | Not run |

## External integration isolation

Controls applied for the app validator run (see application evidence `sideEffectControls`):

| Integration | Isolation result |
| --- | --- |
| Cron routes | Drill env: Google Calendar cron disabled; live remotes not pointed at drill for this local app run |
| Email / Resend | Forced off (`RECEPTION_OS_EMAIL_SEND_ENABLED=false`; reception dry-run true) |
| SMS / Twilio | Forced off (`RECEPTION_OS_SMS_SEND_ENABLED=false`) |
| Stripe / payments | Forced manual / disabled (`FI_PAYMENT_PROVIDER=manual`, `FI_PAYMENTS_ENABLED=false`) |
| HubSpot | Not exercised in this smoke; drill must not wire live webhooks |
| Timely | Not exercised in this smoke; drill must not wire live webhooks |
| Google Calendar | Cron disabled (`FI_GOOGLE_CALENDAR_SYNC_CRON_DISABLED=1`) |
| Pathology email/OCR | Forced off via harness safe env |
| Accounting/live push | Forced off (`FI_ACCOUNTING_LIVE_PUSH=0`) |

## Verdict

| Evidence item | Verdict | Notes |
| --- | --- | --- |
| E4 DB restore drill | PASS | Isolated staging `jzphojhurhguitfuuizo`; marker + counts + DB JSON PASS; app smoke **8/8 PASS** (read-only). Auth orphan SQL + dashboard PITR/available screenshots still desirable. |
| E5 Storage restore drill | PENDING | Bucket **metadata** only; no Storage binary restore / signed-URL read artifact |
| E6 master checklist closure | PENDING | Blocked on E5 (+ optional auth orphan note / verifier). Do not tick DB+Storage restore drill until E5 PASS |

## Remaining gaps

- **E5:** Restore/copy `fi-intakes` (or configured intakes bucket) to isolated staging at aligned timestamp; signed URL read + redacted curl/log; PHI attestation — see [`docs/audits/fi-blk-sec-01-restore-drill-walkthrough.md`](../audits/fi-blk-sec-01-restore-drill-walkthrough.md) Phase C.
- **Auth orphan SQL (walkthrough B3):** Attach `auth.users` ↔ `fi_users.auth_user_id` spot-check output (non-PHI counts only).
- **Timestamps:** Record selected PITR recovery point UTC and dashboard “database available” time into drill env / this sheet.
- **E6:** Tick master checklist DB+Storage restore drill only after E5; update P0 closure when E1–E6 complete with verifier.
- **Cleanup:** Drill project/buckets teardown or controlled retention; confirm no production Vercel env points at drill keys; file next quarterly reminder.
- Mutation journey (`--execute`) intentionally skipped for this evidence cut.

## Cleanup confirmation

| Cleanup item | Result |
| --- | --- |
| Drill project disabled/deleted or retained under approved controls | PENDING |
| Drill buckets/prefixes removed or lifecycle-managed | PENDING (Storage drill not started) |
| No production Vercel env points at drill keys | PENDING (operator confirm) |
| Local evidence retained in ignored directory only | PASS — `docs/security/restore-drill-evidence/` is gitignored |
| Next quarterly reminder filed | PENDING |
