# FI-WEB-REFRESH-1J — FI Patient App + platform progress refresh

**Date:** 2026-07-30  
**Depends on:** FI-WEB-REFRESH-1A…1I, FI-PATIENT-APP-P1 Journey Control  
**Routes:** `/`, `/platform`, `/platform/progress`, Clinic Owners

## Verdict

Public platform progress now treats **FI Patient App** as a distinct patient-facing Operational Pilot surface connected to PatientOS and the wider FI OS — without conflating the two, without speculative completion percentages, and without a dead dedicated module route.

## Dedicated route decision

**Deferred:** `/platform/patient-app`  
No suitable public patient-app screenshots exist. Progress + Platform + homepage band carry the narrative; Learn More on the module card is omitted until a dedicated route is justified.

## Status classification

**Operational Pilot** — Phase 1 Journey Control usable end-to-end in controlled pilot (web at `app.follicleintelligence.ai`, FiOS contracts/gateways, auth/tenant boundaries). Not **Deployed** (no App Store / Play distribution claim).

## Counts (derived from `PLATFORM_PROGRESS_MODULES`)

| Metric | Value |
| --- | --- |
| Systems tracked | 22 |
| Deployed | 3 |
| Operational Pilot | 11 |
| Advanced Build | 6 |
| In Development | 1 |
| Research and Future | 1 |
| Operational or pilot | 14 |

## Production routing note

Canonical production is Vercel project `g-follicleintelligence` serving `follicleintelligence.ai` / `www.follicleintelligence.ai`. `/` and `/platform/progress` are the same Next.js application. Journey Control commit `ceee61c9` previously failed production build on unused-import lint; this ticket includes that unblock so marketing updates can deploy.
