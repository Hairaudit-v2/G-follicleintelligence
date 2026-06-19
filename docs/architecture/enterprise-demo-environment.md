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

## Future Phases

Phase 1F: global command centre dashboard  
Phase 1G: operational anomalies and franchise risk engine
