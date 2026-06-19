# Enterprise Demo Environment

Codename: TITAN

## Purpose

The enterprise demo environment is a permanent simulated global hair restoration franchise network used for sales, investor demos, strategic partnership conversations, and product validation.

## Tenant

Name: International Hair Restoration Group  
Slug: ihrg-global  
Mode: enterprise_simulation

## Phase 1A

- Create demo tenant
- Seed 8 global demo clinics
- Add idempotent seed script
- Add safety guards
- Avoid dashboard work until Phase 1B

## Phase 1B

- Enterprise staff hierarchy generator (5 global leaders + 7 roles × 8 clinics = 61 staff)
- Idempotent `fi_staff` seed with `staff_metadata.enterprise_demo_staff` markers
- Hierarchy links via `staff_metadata.reports_to_staff_id` and `reports_to_demo_key`
- Structured roles via global `fi_staff_position_types` codes
- Clinic assignment via `working_hours._profile.primary_clinic_id`
- No dashboard work yet

## Phase 1C

- Synthetic patient + consultation generator (30 per clinic = 240 total)
- Idempotent `fi_persons` / `fi_patients` / `fi_consultations` seed via `demo_patient_key` and `demo_consultation_key`
- Hair restoration metadata: age band, gender, Norwood/Ludwig/Savin, diagnosis, lead source, consultation status, quoted treatment/value, conversion outcome
- `fi_patient_clinical_details` rows with Norwood/Ludwig scales
- Consultant linkage via Phase 1B `demo_staff_key` when staff rows exist
- No dashboard work yet

## Phase 1D

- Synthetic surgery + graft intelligence generator (12 per clinic = 96 total)
- Idempotent `fi_cases` / `fi_bookings` / `fi_surgeries` seed via `demo_case_key`, `demo_booking_key`, `demo_surgery_key`
- Graft sessions and count events (`count_update`, `tray_count`, `tray_confirmed`, `graft_reconciliation`) with `client_submission_id` idempotency
- Theatre team via `fi_surgery_team_assignments` (surgeon, nurse, technician) with demo `fi_users` linked to staff
- Clinic performance variation and intentional anomalies (London transection, Bangkok reconciliation gaps, Dubai graft-vs-quote, Sydney benchmark)
- Links consultations to cases where schema allows
- No dashboard work yet

## Phase 1E

- Synthetic ImagingOS + AuditOS demo data for 96 surgery cases (metadata-only image paths; no real files required)
- Idempotent `fi_patient_images` via `demo_image_key`, `fi_imaging_protocol_sessions` via case + `titan_surgery_outcome` template, `fi_patient_outcome_measurements` via `demo_audit_key`
- Standard protocol slots: front, left, right, top, crown, donor, immediate_post_op, graft_tray, 3_month, 6_month, 12_month
- Clinic imaging completion profiles: Sydney excellent, London complete with quality flags, Bangkok missing follow-up, Dubai graft-tray mismatch
- Outcome metrics: graft survival estimate, density change, donor recovery, hairline design, patient satisfaction, audit status
- Demo-only metadata flags (`enterprise_demo_image`, `enterprise_demo_audit`, `enterprise_demo_protocol_session`)
- No dashboard work yet

## Phase 1F

- Synthetic FinancialOS + franchise-risk demo data for 240 consultation quotes and 96 surgery financial bundles
- Idempotent `fi_invoices` via `demo_invoice_key`, `fi_payment_requests` / `fi_payments` via `demo_payment_key`, franchise-risk snapshots on `fi_cases` via `demo_financial_risk_key`
- Invoice kinds: `consultation_quote`, `surgery_deposit`, `surgery_balance`, `adjustment`
- Financial lifecycle states: deposit, balance, paid, overdue, partial, refunded, written_off, quote_expired (metadata-backed where schema lacks enum)
- Clinic financial profiles: Sydney clean reconciliation, Dubai graft/invoice variance, Bangkok overdue collection gaps, London refund/adjustment heavy, Athens quote expiry leakage
- Franchise-risk metadata: `revenue_variance_flag`, `inventory_to_graft_variance_flag`, `payment_reconciliation_status`, `franchise_risk_score`, `risk_reason_codes`
- Demo-only payment provider (`demo`); no real Stripe objects
- Links invoices/payments to demo patients, consultations, cases, and bookings where schema allows
- Updates `fi_bookings.financial_os_status` for surgery bundles
- No dashboard work yet

## Clinics

- London Central Institute
- Dubai Hair Institute
- Sydney Hair Institute
- Bangkok Restoration Centre
- Athens Medical Institute
- Los Angeles Hair Institute
- Mumbai Hair Sciences
- São Paulo Hair Institute

## Safety

The seed script must be idempotent and must never mutate non-demo tenants.
Production seeding requires explicit environment approval via `ALLOW_ENTERPRISE_DEMO_SEED=true`.

## Seed command

```bash
npm run seed:enterprise-demo
```

## Phase 1G

- Global Command Centre dashboard at `/fi-admin/{tenantId}/global-command-centre`
- Friendly slug entry `/fi-admin/ihrg-global/global-command-centre`
- Read-only aggregation across Phases 1A–1F (KPIs, clinic risk matrix, alerts, surgical/outcome snapshots)

## Phase 1H

- Presentation mode at `/fi-admin/{tenantId}/global-command-centre/presentation`
- Friendly slug entry `/fi-admin/ihrg-global/global-command-centre/presentation`
- Executive story sections, operator pain callouts, chrome-less layout for screen-share demos

## Phase 1I

- Demo-readiness validation: `npm run validate:titan-global-command-centre`
- Empty-state handling on dashboard panels when seed data is partial
- Demo runbook: `docs/runbooks/titan-global-command-centre-demo.md`
- No major new features — QA and operational hardening only

## Future Phases
