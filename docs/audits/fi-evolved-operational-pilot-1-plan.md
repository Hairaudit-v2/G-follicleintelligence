# FI-EVOLVED-OPERATIONAL-PILOT-1 — Audit plan

**Milestone:** `FI-EVOLVED-OPERATIONAL-PILOT-1`  
**Status:** **IN PROGRESS** — live bake started 2026-07-14  
**Date:** 2026-07-14  
**Mode:** Live clinic-day bake in progress (Decision B host)  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Prior (closed foundations):** role landings · Pipeline · Money · reception · clinical-intelligence trust · staff mapping · golden-patient · CI/typecheck hygiene (`FI-CI-SIGNAL-HYGIENE-1` **COMPLETE / CLOSED**)

---

## 1. Core question

**Can Evolved staff use the agreed core workflows during a real clinic day without developer intervention?**

Success is measured by **how often staff need help to complete ordinary work** — not by automated test count.

---

## 2. Frozen pilot surfaces (in scope)

| Surface | Why in pilot |
| ------- | ------------ |
| Front desk | Reception primary day board / doorway |
| Today | Shared day snapshot / tablet path |
| Calendar and bookings | Scheduling SoR for reception + consultants |
| Pipeline | Enquiry progression (consultants / sales) |
| Patients | Record find + continuity |
| Consultations | Consultant clinical progress |
| Money | Payment / balance states readable and consistent |
| Treatment appointments and imaging | Nurse clinical path |
| Team access and staff mapping | Correct identity after HR sync |

Pilot surfaces are **frozen**. Do not expand the surface list mid-pilot without an explicit scope change.

---

## 3. Out of scope (unless already approved)

- Procedure Day automation (`FI_PROCEDURE_DAY_ENABLED` stays off unless ops explicitly approves)
- Expanded Stripe / payment-provider workflows (`FI_PAYMENTS_ENABLED` stays off unless approved)
- Advanced owner analytics / Reports expansion
- Patient-portal expansion
- New AI features
- New modules or navigation restructuring

Deferred CI/ops backlog from hygiene (**must not delay this pilot**):

| ID | Suggested owner | Note |
| -- | --------------- | ---- |
| CI-TRIAGE-TEAM-01 | Eng / CI | Quarantined team nav; not a pilot gate |
| CI-FIX-01 | Eng / CI | Optional E2E fixtures |
| HR-DRIFT-01 | Ops / HR | Monitor mapping after sync — **does** inform Team access evidence if drift appears during pilot |

---

## 4. Foundational work already closed (do not re-litigate)

| Foundation | Evidence source |
| ---------- | --------------- |
| Role landings | `FI-TRUST-LANDING-AND-SPINE-1` / role bake |
| Pipeline layout / V1 path | Trust pipeline E2E + allowlist |
| Money honesty + Money doorway | `FI-TRUST-MONEY-AND-READINESS-1` |
| Reception Front Desk landing | `FI-TRUST-CI-AND-RECEPTION-1` R1 |
| Clinical-intelligence / readiness trust | Money + readiness live bakes |
| Staff mapping gate | `audit:staff-mapping` |
| Golden-patient spine | Trust spine E2E |
| CI signal + typecheck hygiene | `FI-CI-SIGNAL-HYGIENE-1` GREEN (trust trio + public 0 fails on `87ce552e`) |

This milestone **assumes** those gates hold and gathers **real clinic-day usage** evidence on top.

---

## 5. Roles and evidence to collect

| Role | Surfaces of interest | Evidence per session |
| ---- | -------------------- | -------------------- |
| Reception | Front desk, Today, Calendar/bookings, Patients | Landing, tasks done, wrong turns, missing data, contradictory statuses, failed saves, refresh/re-login integrity, workarounds, support interventions, tablet usability, unresolved blockers |
| Consultant | Pipeline, Consultations, Patients, Calendar | Same evidence set |
| Nurse / clinical | Treatment appointments, imaging, Patients, Today | Same evidence set |
| Finance / Money user | Money (+ related patient balances) | Same; emphasize state consistency |
| Manager / mapped pilot staff | Team access + mapping after HR sync | Correct canonical doorway; mapping matches expected staff_role |

**Key metric:** count (and severity) of times staff needed help to complete ordinary work.

---

## 6. Check matrix (pilot)

| ID | Check | GREEN signal |
| -- | ----- | ------------ |
| P1 | Correct login landing | Staff land on expected role home without hunting |
| P2 | Ordinary tasks completed | Core tasks finish without developer help |
| P3 | Wrong turns / missing data | Tracked; no silent patient-record loss |
| P4 | Contradictory statuses | None unexplained on Money / pipeline / booking |
| P5 | Failed saves / refresh integrity | Core mutations survive reload + re-login |
| P6 | Workarounds / support interventions | Low frequency; logged with owner |
| P7 | Tablet usability | Front Desk / Today usable on clinic tablets |
| P8 | Unresolved blockers | None that stop ordinary work without SOP |
| P9 | Staff mapping | Active pilot staff correctly mapped post HR sync |

---

## 7. Exit criteria — GREEN when all of the following hold

1. No **P0** identity, security, or patient-record issue
2. No core mutation lost after reload
3. Staff identify the correct **canonical doorway** for their role
4. **Reception:** Front Desk + Calendar reliable
5. **Consultants:** enquiries (Pipeline) + consultations progress
6. **Nurses:** treatment appointments + imaging reachable
7. **Money** states understandable and consistent
8. Active pilot staff correctly mapped after HR sync
9. Critical issues resolved **or** have safe SOPs
10. Readiness rescore supported by **real usage** evidence (not only prior automated GREEN)

---

## 8. Method (live bake — started 2026-07-14)

1. Confirm staff mapping gate before clinic day — **done (PASS)** at kickoff
2. Observe / time-box ordinary workflows per role on production (Decision B host) — **S1 Reception Jesika in progress**
3. Log evidence against §5–§6; score help-needed metric
4. File findings in [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md)
5. Only then decide GREEN / AMBER / RED on exit criteria

**Kickoff:** findings marked IN PROGRESS; roster initialized; reception first gate underway.

---

## 9. Related

- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md) — findings stub
- [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md) — CI hygiene closed
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md)
- [fi-trust-money-and-readiness-1.md](./fi-trust-money-and-readiness-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
