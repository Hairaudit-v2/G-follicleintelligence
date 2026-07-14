# FI-EVOLVED-OPERATIONAL-PILOT-1 — Findings

**Milestone:** `FI-EVOLVED-OPERATIONAL-PILOT-1`  
**Status:** **Plan ready / not started**  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)

---

## Executive summary

Audit plan drafted. **Live clinic-day bake has not started.** No pilot evidence recorded yet.

**Core question (unchanged):** Can Evolved staff use agreed core workflows during a real clinic day without developer intervention?

**Key metric:** how often staff need help to complete ordinary work (not test count).

---

## Foundational prerequisites (already closed)

| Area | Prior milestone / note |
| ---- | ---------------------- |
| Role landings | Trust landing / spine + role bake |
| Pipeline | Trust E2E + Pipeline allowlist |
| Money | Trust money + readiness GREEN |
| Reception | Trust CI + reception R1 |
| Clinical-intelligence trust | Readiness / tomorrow live bakes |
| Staff mapping | `audit:staff-mapping` gate |
| Golden-patient | Trust spine |
| CI / typecheck hygiene | `FI-CI-SIGNAL-HYGIENE-1` **COMPLETE / CLOSED** (`87ce552e` / e2e-smoke **29291826298**) |

Deferred backlog that **must not delay** this pilot: CI-TRIAGE-TEAM-01 (Eng/CI), CI-FIX-01 (Eng/CI), HR-DRIFT-01 (Ops/HR).

---

## Frozen pilot surfaces

Front desk · Today · Calendar and bookings · Pipeline · Patients · Consultations · Money · treatment appointments and imaging · Team access and staff mapping.

**Out of scope unless already approved:** Procedure Day automation, expanded Stripe/payment-provider workflows, advanced owner analytics, patient-portal expansion, new AI, new modules or navigation restructuring.

---

## Evidence log (empty — not started)

| Session | Role | Doorway OK? | Tasks completed | Help needed? | Blockers / notes |
| ------- | ---- | ----------- | --------------- | ------------ | ---------------- |
| — | — | — | — | — | Live bake not started |

Per-role fields to fill when bake starts: correct login landing; tasks completed; wrong turns; missing data; contradictory statuses; failed saves; refresh and re-login integrity; workarounds; support interventions; tablet usability; unresolved blockers.

---

## Exit checklist (GREEN when all met — unscored)

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | No P0 identity, security, or patient-record issue | *pending* |
| 2 | No core mutation lost after reload | *pending* |
| 3 | Staff identify correct canonical doorway | *pending* |
| 4 | Reception: Front Desk + Calendar reliable | *pending* |
| 5 | Consultants: enquiries + consultations progress | *pending* |
| 6 | Nurses: treatment appointments + imaging reachable | *pending* |
| 7 | Money states understandable and consistent | *pending* |
| 8 | Active pilot staff correctly mapped after HR sync | *pending* |
| 9 | Critical issues resolved or have safe SOPs | *pending* |
| 10 | Readiness rescore supported by real usage evidence | *pending* |

**Overall verdict:** **N/A — not started**

---

## Related

- [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)
- [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md)
