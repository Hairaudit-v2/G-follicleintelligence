# FI-WEB-REFRESH-1J — FI Patient App + platform progress refresh

**Date:** 2026-07-30  
**Depends on:** FI-WEB-REFRESH-1A…1I, FI-PATIENT-APP-P1 Journey Control  
**Routes:** `/`, `/platform`, `/platform/progress`, Clinic Owners  
**Superseded for dedicated route by:** FI-PATIENT-APP-2A (`/platform/patient-app`)

## Verdict

Public platform progress treats **FI Patient App** as a distinct patient-facing Operational Pilot surface connected to PatientOS and the wider FI OS — without conflating the two, without speculative completion percentages.

## Dedicated route decision

**Resolved in FI-PATIENT-APP-2A:** `/platform/patient-app`  
Public-safe demonstration screenshots now exist. Progress, Platform, homepage band and footer link to the dedicated product page.

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

Canonical production is Vercel project `g-follicleintelligence` serving `follicleintelligence.ai` / `www.follicleintelligence.ai`.
