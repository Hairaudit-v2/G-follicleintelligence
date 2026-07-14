# FI-EVOLVED-OPERATIONAL-PILOT-1 — Findings

**Milestone:** `FI-EVOLVED-OPERATIONAL-PILOT-1`  
**Status:** **IN PROGRESS**  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)  
**Kickoff commit:** `8a058a46`

---

## Executive summary

Live clinic-day bake **started** 2026-07-14. Session 1 is **Reception (Jesika)** via existing platform-admin impersonation on production `follicleintelligence.ai`. Front desk doorway landed correctly; Calendar reachable and eventually shows the same two SMOKETEST surgeries as the board. **No PASS invented for unobserved roles.** Staff-mapping gate **PASS** (record-only). Next ask: finish Reception Calendar mutation+reload, then Consultant (`manager@`).

**Core question:** Can Evolved staff use agreed core workflows during a real clinic day without developer intervention?

**Key metric:** how often staff need help to complete ordinary work (not test count). **Help needed so far (Session 1):** 0 developer interventions for ordinary Front desk / Calendar navigation; auditor-driven bake only.

---

## Kickoff readiness

| Item | Result |
| ---- | ------ |
| Plan read | Done |
| Findings status | **IN PROGRESS** |
| Browser login | **Yes** — impersonating `jesika.watt11` (Reception workspace) on Evolved Front desk |
| Raw staff password login | **Not this session** — Exit impersonation visible |
| First gate | Reception Front desk + Calendar (recommended) — **in progress** |
| Staff mapping `npm run audit:staff-mapping` | **PASS** — 10 operators, 0 missing `fi_staff`, 0 missing access signal (HR-DRIFT monitor only; no fix) |

### Pilot day roster (Evolved)

| Role | Who to exercise | Email (known) | Surfaces | Session status |
| ---- | --------------- | ------------- | -------- | -------------- |
| Reception | Roslyn / Jesika | `roslynhrichards@outlook.com` / Jesika `j***@hotmail.com` (`jesika.watt11`) | Front desk, Today, Calendar/bookings, Patients | **S1 IN PROGRESS** (Jesika impersonation) |
| Consultant | manager@ | `manager@evolvedhair.com.au` | Pipeline, Consultations, Patients, Calendar | *not started* |
| Nurse | Evie | `evieshackleton1@gmail.com` | Treatment appointments, imaging, Patients, Today | *not started* |
| Doctor | Dr Seetal | `seetskd@gmail.com` | Doctor workspace, Calendar, Patients | *not started* (if schedule allows) |
| Finance / clinic admin | Harsh | `harsh@evolvedhair.com.au` (`finance_admin` / Money) | Money (+ balances) | *not started* |
| Manager / mapping | Paul / mapped pilot staff | `paul@evolvedhair.com.au` (owner) | Team access + staff mapping | Mapping gate only so far |

**Exact next session ask (after Reception S1 closes):** Log in or impersonate **Consultant `manager@evolvedhair.com.au`** and exercise Pipeline + Consultations + Patients (canonical CRM doorway).

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

Deferred backlog that **must not delay** this pilot: CI-TRIAGE-TEAM-01 (Eng/CI), CI-FIX-01 (Eng/CI), HR-DRIFT-01 (Ops/HR — monitor only unless P0 identity).

---

## Frozen pilot surfaces

Front desk · Today · Calendar and bookings · Pipeline · Patients · Consultations · Money · treatment appointments and imaging · Team access and staff mapping.

**Out of scope unless already approved:** Procedure Day automation, expanded Stripe/payment-provider workflows, advanced owner analytics, patient-portal expansion, new AI, new modules or navigation restructuring.

---

## Staff mapping snapshot (kickoff)

```
tenant_id=c2615b95-b707-4485-aa5f-be8f78ec868a
operators_with_login: 10
missing_fi_staff: 0
missing_access_signal: 0
PASS: all linked operators have fi_staff mapping
```

Roles seen (masked emails in script): Manager, consultant, Receptionist×2, owner, Nurse×2, Contractor Doctor / Hair Transplant Surgeon, CFO, Manager.

**P9 (mapping):** **PASS at kickoff** — re-check if HR sync runs mid-pilot.

---

## Evidence log

| Session | Role | Doorway OK? | Tasks completed | Help needed? | Blockers / notes |
| ------- | ---- | ----------- | --------------- | ------------ | ---------------- |
| S1 | Reception (Jesika impersonation) | **YES** — Reception workspace → `/front-desk` | View Front desk board; open Calendar (week); confirm 2 SMOKETEST surgeries visible after load | **0** (auditor bake) | See S1 detail; mutation+reload **not yet** scored; tablet N/A desktop |
| — | Consultant (manager@) | — | — | — | *empty — not observed* |
| — | Nurse (Evie) | — | — | — | *empty — not observed* |
| — | Doctor (Seetal) | — | — | — | *empty — not observed* |
| — | Finance (Harsh) | — | — | — | *empty — not observed* |

### Session checklist template (per role)

| Check | Reception S1 | Consultant | Nurse | Doctor | Finance |
| ----- | ------------ | ---------- | ----- | ------ | ------- |
| Correct login landing (P1) | **PASS** — Front desk / Reception workspace (impersonation) | *pending* | *pending* | *pending* | *pending* |
| Ordinary tasks completed (P2) | **PARTIAL** — view board + Calendar; no booking/check-in mutation yet | *pending* | *pending* | *pending* | *pending* |
| Wrong turns / missing data (P3) | Soft-nav Calendar rail briefly stayed on Front desk; direct `/calendar` OK | *pending* | *pending* | *pending* | *pending* |
| Contradictory statuses (P4) | See findings F-PILOT-01 / F-PILOT-02 | *pending* | *pending* | *pending* | *pending* |
| Failed saves / refresh integrity (P5) | **Not tested** — no mutation this slice | *pending* | *pending* | *pending* | *pending* |
| Workarounds / support interventions (P6) | None observed | *pending* | *pending* | *pending* | *pending* |
| Tablet usability (P7) | **Not observed** (desktop browser) | *pending* | *pending* | *pending* | *pending* |
| Unresolved blockers (P8) | Room-assignment blockers on SMOKETEST appts — test fixtures, not live patient stop | *pending* | *pending* | *pending* | *pending* |

---

## Session 1 detail — Reception (Jesika) · 2026-07-14

**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating **jesika.watt11** · badge **Reception workspace** · profile `jesika.watt11@hotma…` · **Exit impersonation** visible  
**Tool:** cursor-ide-browser MCP

| Step | Observation |
| ---- | ----------- |
| Open existing tab | URL already `/front-desk`; board Today with counters Running late 1 · Waiting 0 · Arriving soon 1 · Blockers 2 |
| Board content | SMOKETEST surgery cards (room missing); Needs attention list with readiness/room blockers |
| Calendar | Loads week view; after settle shows **Today · 2 appointments** matching board SMOKETEST HT surgeries (08:00 + 10:00) |
| Return to Front desk | Board still usable; subtitle / Payment due count shifted vs earlier snapshot (see F-PILOT-02) |

### Observations / findings (do not invent severity beyond evidence)

| ID | Severity | Note |
| -- | -------- | ---- |
| F-PILOT-01 | **P2 (observe)** | First Calendar paint briefly showed **READ-ONLY** + **Today · 0 appointments** while Front desk already listed the same-day SMOKETEST rows; after settle → **LIVE** + **2 appointments**. Transient contradiction / load flicker — not scored as lost patient data. |
| F-PILOT-02 | **P2 (observe)** | Status vocabulary tension: Front desk **Waiting = 0** while Calendar summary **Waiting = 2** for the same two unarrived surgeries (FD uses Running late / Arriving soon). Risk of staff confusion — not silent record loss. |
| F-PILOT-03 | **note** | Soft click on Calendar rail left URL on `/front-desk` briefly (busy state); direct navigate to `/calendar` succeeded. |
| F-PILOT-04 | **note** | Session is **impersonation**, not raw Jesika/Roslyn password login — identity doorway still valid for reception chrome; raw-login still desirable for P1 purity. |
| F-PILOT-05 | **note** | After Calendar round-trip, Front desk briefly showed tenant-level subtitle + **Payment due = 0** without readiness row; **Refresh** restored **Perth** subtitle, **Payment due = 1**, and surgery-readiness blocker. Favours stale/partial hydrate over permanent mutation loss — still tighten before GREEN on P5. |

**No P0** identity/security/patient-record loss observed in S1 slice. **No code fix** applied (observations only).

---

## Exit checklist (GREEN when all met — unscored overall)

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | No P0 identity, security, or patient-record issue | *pending* (S1: none observed) |
| 2 | No core mutation lost after reload | *pending* — not tested |
| 3 | Staff identify correct canonical doorway | *partial* — Reception YES |
| 4 | Reception: Front Desk + Calendar reliable | *partial* — both reachable; mutation TBD |
| 5 | Consultants: enquiries + consultations progress | *pending* |
| 6 | Nurses: treatment appointments + imaging reachable | *pending* |
| 7 | Money states understandable and consistent | *pending* |
| 8 | Active pilot staff correctly mapped after HR sync | **PASS at kickoff** |
| 9 | Critical issues resolved or have safe SOPs | *pending* |
| 10 | Readiness rescore supported by real usage evidence | *pending* |

**Overall verdict:** **IN PROGRESS** — not GREEN / not RED

---

## Related

- [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)
- [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md)
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
