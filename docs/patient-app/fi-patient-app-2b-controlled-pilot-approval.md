# FI-PATIENT-APP-2B — Controlled pilot approval packet

**Ticket:** FI-PATIENT-APP-2B  
**Date:** 2026-07-30  
**Repos:** `follicleintelligence` · `follicle-intelligence-patient`  
**Hard stop:** Do **not** invite, activate, or notify real patients from this milestone.

Companion 2A baseline: `docs/marketing/fi-patient-app-2a-public-page-and-pilot-readiness.md`

---

## 1. Executive verdict

| Item | Result |
| --- | --- |
| Public production page | **PASS** |
| Kill switch / pause (code + unit proof) | **PASS** |
| Patient deactivation / withdrawal (code + unit proof) | **PASS** |
| Notification suppression (code) | **PASS** |
| Named FI + engineering owners | **PASS** (pending contact sheet in protected ops store) |
| Named clinic pilot owner | **OPEN** — placeholder pending clinic confirmation |
| Usability cohort (≥10 sessions) | **OPEN** — plan ready; sessions not executed |
| Device accessibility evidence | **OPEN** — code/label audit only; VoiceOver/TalkBack device pack not signed |
| Controlled mobile distribution | **PARTIAL** — Web/PWA proven; iOS bundle id added; TestFlight/Play install proof not completed |
| Support drill | **PARTIAL** — tabletop documented; live drill with clinic owner blocked until named |
| Overall | **AMBER — NOT READY FOR APPROVAL** |

**No real patients were invited. No real patient accounts were activated. No real patient push notifications were sent.**

---

## 2. Production deployment verification

| Check | Evidence |
| --- | --- |
| Deployment | `dpl_Ab6YeM5mmx9gxbwPZ7g9zzh8KsM2` |
| Commit | `1463b2ab70d9d16020b74d76d82a1a300baf5df7` |
| `readyState` | **READY** (production target; aliases include `follicleintelligence.ai`) |
| `GET /platform/patient-app` | **200** |
| `GET /patient-app` | **308** → `/platform/patient-app` |
| `GET /platform/patientos-app` | **308** → `/platform/patient-app` |
| Title | `FI Patient App \| Connected Hair Restoration Patient Journey` |
| H1 | The patient journey, in the patient’s hands. |
| Operational Pilot | Visible |
| Availability note | Public app-store distribution is not yet available |
| App-store implication | Not claimed |
| PatientOS vs Patient App | Distinguished on page |
| Screenshots | 5 assets; origin WebPs return **200**; lazy images load with deploy id in `_next/image` URL |
| Real clinic brand on public page | No Evolved leak in page text |
| Related links | `/`, `/platform`, `/platform/progress`, `/clinic-owners` return **200** |

Public product readiness for 2A remains intact.

---

## 3. Named pilot owners

Operational contacts must stay in **protected internal storage** (not the public site). Repository records roles and named principals only.

| Role | Full name | Organisation | Contact method | Availability | Backup delegate | Escalation authority |
| --- | --- | --- | --- | --- | --- | --- |
| Clinic pilot owner | **TBD — pending clinic confirmation** | Pilot clinic (proposed: Evolved / confirmed tenant) | Clinic ops channel (protected) | Clinic business hours | TBD | Can escalate to FI pilot + withdraw patients |
| FI pilot owner | **Thelo** | Follicle Intelligence | FI protected ops channel | Agreed business hours (not 24/7) | Engineering escalation (same seat for early pilot) | Pause/rollback, L2 support, reporting |
| Engineering escalation | **Thelo** (early-pilot dual seat) | Follicle Intelligence | Engineering protected channel | Agreed hours; security/identity **immediate** | FI product backup TBD | Security, identity mismatch, cross-tenant, rollback |

### Responsibilities accepted (conditional)

- FI / engineering: **accepted** for technical readiness, monitoring, pause/rollback, L2/L3.
- Clinic: **not accepted** until named owner confirms written acceptance of L1, eligibility, withdrawal, and fallback communication.

**Gate:** Clinic owner name + backup + acceptance → still **FAIL**/open → overall approval withheld.

---

## 4. Pilot clinic and pathways

| Parameter | Decision |
| --- | --- |
| Clinics | **One** tenant (confirm identity in protected ops before invites) |
| Cohort size | **10–15** invited patients (hard max 25 only if L1 capacity proven) |
| Primary pathway | **Pre-surgery readiness** (quote review, documents, pathology requirements, preparation milestones, next action) |
| Optional secondary | Quote/document completion before procedure confirmation |
| Scope | Phase 1 Journey Control only |
| Registration | No public self-registration |
| Distribution | Controlled only (no public store) |

### Exclusions (enforced at selection)

Emergency/urgent pathways; complex repair; ambiguous identity; multi-clinic patients; unsupported language; unvalidated accessibility needs; journeys needing future app features; staff test identities mixed into live cohort.

---

## 5. Proposed cohort manifest (safe references only)

Store the filled worksheet in protected ops storage. Repository holds the **template only**.

| Internal ref | Clinic | Pathway | Eligibility | Identity | Consent | Invite ready | Exclusion check | Support notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PILOT-P01` … `PILOT-P15` | _confirmed tenant_ | Pre-surgery readiness | Pending clinic | Pending | Pending | **No** until GREEN + written invite approval | Pending | — |

Do not commit patient names, emails, or health information.

---

## 6. Usability evidence

**Status: NOT EXECUTED** (do not invent results).

Plan: `docs/patient-app/fi-patient-app-2b-usability-test-plan.md`

| Gate | Required | Status |
| --- | --- | --- |
| 100% next-action identification | Yes | Open |
| 100% Help locate | Yes | Open |
| 100% emergency disclaimer comprehension | Yes | Open |
| ≥90% unassisted core task success | Yes | Open |
| No unresolved Critical / High (pilot pathway) | Yes | Open |
| Ease/usefulness medians | Scale defined in plan | Open |

---

## 7. Accessibility evidence

**Status: PARTIAL — code audit only; device pack open.**

| Check | Status |
| --- | --- |
| Labels / roles on core surfaces | Partial (Patient App) |
| `maxFontSizeMultiplier` widespread | Present |
| VoiceOver device evidence | **Not completed** |
| TalkBack device evidence | **Not completed** (Android may be excluded from cohort until proven) |
| Large text / reduced motion device evidence | **Not completed** |

Plan / checklist: `docs/patient-app/fi-patient-app-2b-accessibility-evidence.md`

---

## 8. Kill-switch proof

| Step | Result |
| --- | --- |
| Tenant pause metadata contract | Implemented |
| Gateway deny `pilot_paused` | Unit test J **PASS** |
| Global env pause | Core unit **PASS** |
| Push suppression when paused | Code path + core unit **PASS** |
| Recovery to enabled | Unit recovery path **PASS** (withdraw case K; pause resume via merge/API) |
| Preserve journey data | By design (deny only; no deletes) |
| Audit actions | `pilot_paused` / `pilot_resumed` |

Runbook: `docs/runbooks/patient-app-pilot-pause-and-withdrawal.md`

Live demonstration-patient pause against production was **not** run in this milestone (avoids mutating live tenants without explicit ops window).

---

## 9. Deactivation and withdrawal proof

| Capability | Result |
| --- | --- |
| Patient metadata access states | Implemented |
| Unlink `portal_auth_user_id` | Implemented in `setPatientAppAccess` |
| Disable devices + push pref false | Implemented |
| Invitation reuse blocked flag | Default true |
| Gateway deny `patient_withdrawn` / `patient_deactivated` | Unit **PASS** |
| App mapping of safe messages | Patient App `client.ts` updated |
| Durable CRM timeline withdraw event | Optional / still ops log + gateway audit |

---

## 10. Distribution readiness

| Channel | Status |
| --- | --- |
| Web / PWA `app.follicleintelligence.ai` | Proven pilot surface |
| EAS internal preview/development | Configured |
| iOS `bundleIdentifier` | **Added** `com.follicleintelligencesteam.follicleintelligence` |
| EAS `pilot-ios` / `pilot-android` profiles | Added with **placeholder** ASC/team IDs |
| TestFlight install + login + notification proof | **Not completed** |
| Play internal install proof | **Not completed** |
| Public App Store / Play | Out of scope |

**Cohort rule:** Until iOS and/or Android install proofs exist, limit eligibility to platforms with a proven controlled channel (currently **web/PWA** only for distribution readiness).

---

## 11. Support and escalation drill

Tabletop: `docs/patient-app/fi-patient-app-2b-support-drill.md`

| Gate | Status |
| --- | --- |
| Owners understand roles | FI/eng yes; clinic owner open |
| Fallback communication | Documented (clinic channel) |
| Security escalate immediate | Documented |
| Incident evidence retained | Gateway audit + ops log |
| Clinic continues without app | Documented |

Live joint drill with named clinic owner: **blocked** until Phase 2 closes.

---

## 12. Metrics readiness

Scorecard: `docs/patient-app/fi-patient-app-2b-pilot-metrics-scorecard.md`

- Operational scorecard defined (activation, engagement, completion, clinic impact, reliability, safety, experience)
- **No PHI** in analytics events (names, email, pathology results, diagnosis, quote/document content, free-text medical)
- Product analytics SDK remains intentionally absent; use approved operational reports + support logs
- Review cadence: weekly during pilot by FI pilot owner with clinic L1 input

---

## 13. Security and identity

| Check | Status |
| --- | --- |
| Gateway ownership / tenant isolation unit tests | Pass (existing + pause/withdraw extensions) |
| Unlinked / inactive fail closed | Pass |
| Pilot pause / withdraw fail closed | Pass (new) |
| Public screenshots without live Evolved branding | Pass |
| Critical live security blocker | None newly identified; full threat matrix still partially signed |

---

## 14. Risk register (remaining)

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Clinic owner unnamed | High (approval blocker) | Confirm names + acceptance before GREEN |
| Usability untested with humans | High | Execute plan; fix Critical/High |
| VoiceOver/TalkBack unsigned | High | Device pack or exclude platform |
| Native distribution unproven | High | Web-only cohort or complete TF/Play |
| Dual FI/eng seat (single person) | Medium | Name backup delegate before live scale |
| Live kill-switch not exercised on prod tenant | Medium | Ops window with demo patient after approval for invite is still separate |
| Withdraw CRM timeline optional | Low | Accept gateway audit for early pilot |

---

## 15. Promotion / pause criteria

Unchanged from 2A §18–19, plus enforced pause controls above.

Even if later marked GREEN — READY FOR APPROVAL:

- Stop before invitations
- Stop before activation links
- Stop before adding real patient records to the live cohort worksheet
- Require **separate explicit instruction** for the first invitation batch

---

## 16. Recommendation

**AMBER — NOT READY FOR APPROVAL**

Authority may treat public product readiness as complete. Controlled pilot **must not** be approved for live patient invitation until open gates in §1 close.

---

## 17. Files changed (this milestone)

### follicleintelligence

- `src/lib/patientPortal/patientAppPilotControlsCore.ts` (+ test)
- `src/lib/patientPortal/patientAppPilotControls.server.ts`
- `src/lib/patientPortal/patientGatewayTypes.ts`
- `src/lib/patientPortal/patientGatewayGate.server.ts` (+ test extensions)
- `src/lib/patientPortal/patientNotificationDispatch.server.ts`
- `docs/runbooks/patient-app-pilot-pause-and-withdrawal.md`
- `docs/patient-app/*` (2B packet, usability, a11y, support, metrics, cohort template)
- `docs/marketing/fi-patient-app-2a-public-page-and-pilot-readiness.md` (2B pointer)

### follicle-intelligence-patient

- `src/api/client.ts` (pause/withdraw safe messages)
- `app.json` (iOS bundleIdentifier)
- `eas.json` (pilot profiles)
- `docs/patient-app/fi-patient-app-2b-controlled-pilot-approval.md` (mirror)
- mirrored plans / scorecard as needed

---

## 18. Tests and builds

| Suite | Result |
| --- | --- |
| `patientAppPilotControlsCore.test.ts` | Pass |
| `patientGatewayGate.server.test.ts` (incl. J/K) | Pass |
| Marketing page tests / Journey Control proofs / full typecheck / production build | Run/recorded in close-out notes |
| Patient App typecheck / proof | Run/recorded in close-out notes |
| iOS/Android pilot EAS builds | Not claimed complete in this packet |

---

## 19. Commit hashes

Record after commit on each repo (branch `feature/fi-patient-app-2b-controlled-pilot-approval`).

Base baselines:

- FiOS public page: `1463b2ab70d9d16020b74d76d82a1a300baf5df7`
- Patient App 2A: `81cffa85d94fc0e29cbb88d4bac9b408328929c9`

---

## 20. Final label

### AMBER — NOT READY

Explicit confirmation: **no real patients were invited under FI-PATIENT-APP-2B.**
