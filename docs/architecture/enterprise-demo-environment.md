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

Phase 1B: staff hierarchy  
Phase 1C: synthetic patients and consultations  
Phase 1D: surgeries and graft intelligence  
Phase 1E: global command centre dashboard  
Phase 1F: operational anomalies and franchise risk engine
