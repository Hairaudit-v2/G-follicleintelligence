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

Phase 1C: synthetic patients and consultations  
Phase 1D: surgeries and graft intelligence  
Phase 1E: global command centre dashboard  
Phase 1F: operational anomalies and franchise risk engine
