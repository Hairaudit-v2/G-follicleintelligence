# FI-SECURITY-RESTORE-DRILL-1 findings

Use this template after the restore is completed into a new isolated Supabase project. Do not record secrets, PHI values, or signed URL tokens.

## Drill metadata

| Field | Value |
| --- | --- |
| Operator |  |
| Verifier |  |
| Date (UTC) |  |
| Source production project ref | `iqqvzgxoimxchhcnbzxl` |
| Restored project ref | `jzphojhurhguitfuuizo` |
| Environment | Isolated staging only |
| Backup type | Physical backup / PITR |
| Retention |  |
| Selected recovery point (UTC) |  |
| Restore request time (UTC) | `2026-07-14T08:01:01.479521Z` |
| Database available time (UTC) |  |
| Application validated time (UTC) |  |
| Measured RPO |  |
| Database RTO |  |
| Operational RTO |  |

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
| Auth identities intact | PENDING | Run authenticated validator |
| Staff mappings intact | PASS | `fi_staff` 87; access grants 21 |
| Access grants intact | PASS | `fi_staff_access_grants` 21 |
| Migration history captured | PASS | 259 migrations; latest `20261014120001`; SQL evidence |

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

## Application validation

| Surface | Result | Evidence |
| --- | --- | --- |
| Today |  |  |
| Front Desk |  |  |
| Pipeline |  |  |
| Patients |  |  |
| Calendar |  |  |
| Consultations |  |  |
| Money |  |  |
| Team / staff mapping |  |  |
| Case / readiness surface |  |  |
| Recovery-only mutation |  |  |
| Hard reload persistence |  |  |
| Mutation reverted |  |  |

## Storage validation

Database restore does not prove Storage binary recovery. Record separate Storage restore evidence here.

| Check | Result | Evidence |
| --- | --- | --- |
| Bucket metadata inventoried |  |  |
| Critical object classes identified |  |  |
| Storage restore/copy target isolated |  |  |
| Signed URL read succeeded |  |  |
| Signed token redacted from evidence |  |  |
| Expiry / wrong-tenant behavior checked |  |  |

## External integration isolation

| Integration | Isolation result |
| --- | --- |
| Cron routes |  |
| Email / Resend |  |
| SMS / Twilio |  |
| Stripe / payments |  |
| HubSpot |  |
| Timely |  |
| Google Calendar |  |
| Pathology email/OCR |  |
| Accounting/live push |  |

## Verdict

| Evidence item | Verdict | Notes |
| --- | --- | --- |
| E4 DB restore drill | PASS | Read-only validator passed; evidence JSON generated |
| E5 Storage restore drill |  |  |
| E6 master checklist closure |  |  |

## Remaining gaps

- Auth user spot-check was not supplied; validator confirmed 11/11 linked `fi_users` mapped to `fi_staff`.
- Set `FI_BASE_URL` and `FI_SMOKE_TENANT_ID`, then run `npm run audit:restore-drill:app` with all live integrations disabled.
- Record PITR timestamp, retention, Storage validation, and application results.

## Cleanup confirmation

| Cleanup item | Result |
| --- | --- |
| Drill project disabled/deleted or retained under approved controls |  |
| Drill buckets/prefixes removed or lifecycle-managed |  |
| No production Vercel env points at drill keys |  |
| Local evidence retained in ignored directory only |  |
| Next quarterly reminder filed |  |
