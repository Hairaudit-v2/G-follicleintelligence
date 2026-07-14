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

Database restore does not prove Storage binary recovery. E5 binary copy + access checks executed 2026-07-14 via `npm run audit:restore-drill:storage` (source production read-only → destination `jzphojhurhguitfuuizo` only). Aggregate evidence only — no object paths, signed URLs, or PHI in this sheet.

| Bucket | Objects | Total bytes | Copied | Verified | Checksum match |
| --- | ---: | ---: | ---: | ---: | ---: |
| `patient-images` | 13 | 20 033 896 | 12 | 13 | 13 |
| `tenant-branding` | 1 | 20 481 | 0 (already present) | 1 | 1 |
| **Totals** | **14** | **20 054 377** | **12** | **14** | **14** |

| Check | Result | Evidence |
| --- | --- | --- |
| Bucket metadata inventoried | PASS | DB validator earlier; E5 scoped to `patient-images` + `tenant-branding` (14 objects) |
| Critical object classes identified | PASS (scoped) | Patient images + tenant branding; intakes/financial buckets out of this E5 cut |
| Storage restore/copy target isolated | PASS | Destination project `jzphojhurhguitfuuizo` only; production write APIs unused |
| Signed URL read succeeded | PASS | Short-lived signed URL GET on one private `patient-images` object |
| Unsigned private access | DENIED | Public/unsigned URL for same private object did not return content |
| Tenant-branding application read | PASS | Readable per existing destination bucket policy (signed path; bucket non-public) |
| Application read | PASS | Signed download treated as storage application read |
| Temporary-file cleanup | PASS | `.tmp-restore-drill-storage/` temps deleted after checksum validation |
| PHI handling attestation | PASS | No filenames, patient IDs, signed URLs, keys, or object paths committed; source ops list/download only; production policies unchanged |
| Signed token redacted from evidence | PASS | Tokens never written to committed docs; evidence JSON gitignored under `docs/security/restore-drill-evidence/` |
| Independent long-term Storage backup | NOT DEFINED | No operated secondary/cold Storage backup yet → E5 verdict **AMBER** |

**Storage evidence (local, gitignored):** `docs/security/restore-drill-evidence/restored-storage-jzphojhurhguitfuuizo-2026-07-14T09-56-03-768Z.json` (verdict AMBER).

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
| E5 Storage restore drill | AMBER | 14/14 objects verified (size + SHA-256); signed URL PASS; unsigned private DENIED; branding read PASS; **independent long-term Storage backup not defined** |
| E6 master checklist closure | PENDING | E4 PASS + E5 AMBER evidenced; needs verifier initials, cleanup confirmation, master checklist formal close, long-term Storage backup decision |

## Remaining gaps

- **E6:** Verifier initials; tick/confirm master checklist restore-drill row; cleanup or controlled retention of drill project; confirm no production Vercel env points at drill keys; file next quarterly reminder.
- **Long-term Storage backup posture:** Choose and document operated secondary (native/export/rclone/etc.) to promote E5 AMBER → PASS.
- **Auth orphan SQL (walkthrough B3):** Attach `auth.users` ↔ `fi_users.auth_user_id` spot-check output (non-PHI counts only).
- **Timestamps:** Record selected PITR recovery point UTC and dashboard “database available” time into drill env / this sheet.
- Optional: expand E5 scope to `hli-intakes` / `fi-financial-documents` if those hold production-critical binaries for Evolved.
- Mutation journey (`--execute`) intentionally skipped for this evidence cut.

## Cleanup confirmation

| Cleanup item | Result |
| --- | --- |
| Drill project disabled/deleted or retained under approved controls | PENDING |
| Drill buckets/prefixes removed or lifecycle-managed | PENDING (binaries remain on isolated recovery for drill retention — lifecycle TBD) |
| No production Vercel env points at drill keys | PENDING (operator confirm) |
| Local evidence retained in ignored directory only | PASS — `docs/security/restore-drill-evidence/` + `.tmp-restore-drill-storage/` gitignored |
| Next quarterly reminder filed | PENDING |
