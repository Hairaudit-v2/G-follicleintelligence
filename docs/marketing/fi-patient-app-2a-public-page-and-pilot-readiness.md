# FI-PATIENT-APP-2A — Public product page and controlled pilot readiness

**Ticket:** FI-PATIENT-APP-2A  
**Date:** 2026-07-30  
**Repos:** `follicleintelligence` (public page) · `follicle-intelligence-patient` (app pilot surfaces)  
**Stop boundary:** Prepare controlled pilot — do **not** invite real patients without explicit approval.

---

## 1. Executive verdict

| Outcome | Verdict |
| --- | --- |
| Public product readiness | **PASS** (with documented screenshot method) |
| Controlled pilot readiness | **AMBER — READY FOR APPROVAL withheld** |
| Overall | **AMBER** |

Public `/platform/patient-app` ships with accurate Operational Pilot positioning, PatientOS distinction, FAQ, metadata, sitemap, internal links, and five public-safe demonstration screenshots.

Controlled pilot operations are **defined and partially implemented**, but several mandatory gates remain open (named owners, proven feature-flag pause, account deactivation, structured usability testing, mobile distribution proof, dedicated public-safe live tenant). **Do not invite live patients yet.**

---

## 2. Current readiness audit

### Implemented (Phase 1 Journey Control)

| Capability | Patient App | FiOS SoR |
| --- | --- | --- |
| Home next step | Yes | Journey `nextAction` |
| Action Centre | `/actions` | `/api/patient/v1/actions` |
| Journey Timeline | `/journey` | Journey milestones |
| Quotes | `/quotes/[quoteId]` | Quotes API |
| Documents | `/documents` | Documents API |
| Pathology | `/pathology` | Pathology API |
| Push deep links | `src/notifications/routing.ts` | Notification events |
| Staff readiness | — | Clinic journey readiness ribbon |
| Auth / logout | Yes | Gateway ownership gate |
| Help & emergency disclaimer | Added in 2A (`/account/help`) | Privacy at `/privacy` |

### Gaps remaining for live pilot

| Gap | Status |
| --- | --- |
| Named clinic pilot owner | **Not assigned** |
| Named FI pilot owner | **Not assigned** |
| Product feature-flag pause proven | **Documented only** — no tenant `patient_app_pilot` flag |
| Account deactivation API/UI | **Logout only** — deactivation is operator process |
| Invitation / withdrawal UX | **Clinic-operated process** — not in-app self-serve |
| Public-safe live demo tenant (Alex Morgan) | **Fixture HTML used for marketing** — live Gateway Demo shows Evolved branding (blocked for public shots) |
| Structured usability test cohort | **Not executed** |
| VoiceOver / TalkBack evidence pack | **Not completed** |
| TestFlight / Play internal track config | **EAS internal profiles exist; submit stubs incomplete; iOS bundle id missing** |
| Pilot analytics scorecard instrumentation | **Intentionally absent product analytics** |

---

## 3. Public product route

**Canonical:** `/platform/patient-app`

Permanent redirects:

- `/patient-app` → `/platform/patient-app`
- `/platform/patientos-app` → `/platform/patient-app`

Do **not** publish duplicate content at `/app` or `/patient` (authenticated portal paths).

PatientOS remains at `/platform/patient-os`.

---

## 4. Final public copy

Canonical content module:

`follicleintelligence/lib/marketing/patientAppPageContent.ts`

| Element | Copy |
| --- | --- |
| Headline | The patient journey, in the patient’s hands. |
| Status | Operational Pilot |
| Status statement | Core patient journey workflows are implemented and available within controlled pilot scope. Wider patient deployment, support validation and distribution readiness are continuing. |
| Availability | Available within approved clinic pilot programmes. Public app-store distribution is not yet available. |
| Primary CTA | Request a Platform and Migration Review → `/demo` |
| Secondary CTA | View Platform Progress → `/platform/progress` |
| Optional | Explore PatientOS → `/platform/patient-os` |

---

## 5. Screenshot set

| # | Screen | Path | Viewport |
| --- | --- | --- | --- |
| 1 | Home next step | `/os-images/patient-app/patient-app-home-next-step.webp` | iPhone |
| 2 | Action Centre | `/os-images/patient-app/patient-app-action-centre.webp` | iPhone |
| 3 | Journey Timeline | `/os-images/patient-app/patient-app-journey-timeline.webp` | iPhone |
| 4 | Quote | `/os-images/patient-app/patient-app-quote.webp` | iPhone |
| 5 | Pathology | `/os-images/patient-app/patient-app-pathology.webp` | Android |

Inventory: `follicleintelligence/docs/marketing/screenshots/fi-patient-app-2a/screenshot-inventory.json`

**Identity (synthetic only):**

- Patient: Alex Morgan  
- Clinic: FI Demonstration Clinic  
- Account: demo.patient@follicleintelligence.ai  

**Method:** Public-safe Phase 1 UI mirror fixture (`scripts/patient-app-marketing-shots/`). Live `e2e-patient-gateway-mobile@fi-demo.example` tenant was **not** used because `/me` returns Evolved Hair Restoration branding.

---

## 6. PatientOS versus Patient App

| | PatientOS | FI Patient App |
| --- | --- | --- |
| Audience | Clinic staff | Patients |
| Definition | Clinic-facing longitudinal patient record shared across FI workflows | Patient-facing mobile experience for actions, milestones, next steps, quotes, documents, pathology and journey communication |
| Route | `/platform/patient-os` | `/platform/patient-app` |

Forbidden public names for the Patient App: PatientOS, Patient Portal, Patient JourneyOS, Consumer App, Mobile PatientOS, Clinic App, Hair Restoration App.

---

## 7. Public status and limitations

**Status:** Operational Pilot — not Deployed.

**Do not claim:** public App Store / Play availability, download now, thousands of patients, fully launched, ready for every clinic, payments (unless separately approved), medical advice, pathology result interpretation, or that every clinic pathway is configured.

---

## 8. Pilot scope

| Parameter | Recommendation |
| --- | --- |
| Clinics | One clinic tenant initially |
| Patients | 10–25 invited patients (final size by support capacity) |
| Pathways | One or two well-defined pathways |
| Capability | Phase 1 Journey Control only |
| Registration | No public self-registration |
| Distribution | No uncontrolled public store release |
| Payments | Out of scope unless separately approved |
| Medical / emergency | Not for medical advice or emergency communication |
| Expansion | No multi-clinic expansion until gates pass |

Potential initial pathways: pre-surgery readiness; quote and document completion; pathology completion; upcoming procedure preparation.

---

## 9. Eligibility and exclusions

**Eligible patients**

- Linked FI patient identity  
- Approved active journey  
- Comfortable with smartphone use  
- Push or fallback communication available  
- Willing to provide feedback  
- Not dependent on the app for urgent clinical care  
- Supported by an identified clinic coordinator  

**Exclusions**

- Ambiguous / duplicate identity  
- No verified clinic relationship  
- Unsupported language where comprehension is at risk  
- Unvalidated accessibility needs  
- Features outside Phase 1  
- Emergency / urgent clinical communication needs  
- Complex multi-clinic ownership  
- Missing consent  
- Staff test identities mixed into patient cohort  

---

## 10. Onboarding flow

### Clinic preparation checklist

- [ ] Confirm clinic participation  
- [ ] Assign clinic pilot owner (**name required before go-live**)  
- [ ] Confirm support contacts  
- [ ] Confirm eligible pathways  
- [ ] Confirm staff training  
- [ ] Confirm escalation process  
- [ ] Confirm privacy notice  
- [ ] Confirm patient invitation language  
- [ ] Confirm withdrawal process  

### Patient invitation must include

- Pilot explanation  
- What the app can / cannot do  
- Access instructions  
- Privacy information  
- Support contact  
- Emergency disclaimer  
- Feedback expectations  
- Withdrawal option  

### Activation checks

- Correct identity linkage  
- Secure authentication  
- No cross-tenant access  
- No patient-to-patient exposure  
- Correct clinic journey  
- Notification routing or fallback  
- Fallback channel if push fails  

### First-use experience (target)

Welcome → short explanation → privacy acknowledgement → notification permission context → next-step orientation → support access → emergency disclaimer.

In-app: Home + Account show emergency disclaimer; Help screen documents support levels and privacy link.

---

## 11. Consent and privacy

| Topic | Treatment |
| --- | --- |
| Privacy policy | https://follicleintelligence.ai/privacy |
| Photography consent | Existing `/progress/consent` attestation |
| Pilot participation consent | Clinic invitation language + withdrawal path (operator) |
| Notification consent | Notification preferences screen + OS permission |
| Analytics | No product analytics SDK — do not emit PHI in events |
| Crash reporting | Not enabled as a patient PHI channel in current pilot posture |
| Support access | Clinic L1; FI pilot L2 with access logging via existing FiOS admin controls |
| Deactivation | Operator-managed unlink / revoke; patient can sign out |

Analytics must never include: patient name, email, pathology result, diagnosis, quote detail, document content, free-text medical information.

---

## 12. Support and escalation

| Level | Owner | Scope |
| --- | --- | --- |
| L1 | Clinic pilot owner / coordinator | Invitation, login help, journey/quote/document/pathology questions |
| L2 | FI pilot owner | Technical access, app errors, notification routing, journey state, navigation failures |
| L3 | Engineering | Security, cross-tenant, data mismatch, identity, repeated crash, action not reflected in FI |

**Hours:** Clinic-defined + FI agreed business hours. **Do not promise 24/7.**

**Fallback:** If the app fails, clinic communication continues on the approved channel; staff retain journey visibility; patient access can be disabled; pilot can pause without corrupting journey state.

**Owner assignment (required before live invitations):**

| Role | Name | Contact |
| --- | --- | --- |
| Clinic pilot owner | _TBD — assign before approval_ | |
| FI pilot owner | _TBD — assign before approval_ | |

---

## 13. Distribution readiness

| Channel | Status |
| --- | --- |
| Web / PWA `app.follicleintelligence.ai` | Proven pilot surface |
| EAS `preview` internal | Configured |
| EAS `development` internal | Configured |
| TestFlight | Not fully configured (submit stub; iOS `bundleIdentifier` missing in `app.json`) |
| Google Play internal | Android package present; submit track not documented |
| Public App Store / Play | **Out of scope** for this milestone |

Record at each pilot build: iOS method, Android method, version, channel, expiry, invitation process, update process.

---

## 14. Security verification

| Check | Status |
| --- | --- |
| Gateway ownership / tenant isolation tests | Pass (FiOS unit/core tests) |
| Unlinked / wrong patient fail closed | Pass (2A.1 evidence) |
| Logout clears session + push unregister | Pass (2G + auth session proofs) |
| Live Evolved demo not used for public screenshots | Pass (blocked intentionally) |
| Feature-flag kill switch | **Open** — document pause via stop invitations + revoke portal links + disable distribution |
| Threat scenarios matrix (wrong link, expired invite, cross-tenant deep link, etc.) | **Partial** — ownership tests cover core; full matrix not signed off |

Pause immediately on wrong patient data, cross-tenant exposure, identity ambiguity, incorrect critical completion, sensitive notification content, or support overload.

---

## 15. Accessibility verification

| Check | Status |
| --- | --- |
| Labels / roles on core controls | Partial — present on many surfaces |
| Dynamic type caps | Widespread `maxFontSizeMultiplier` |
| VoiceOver / TalkBack evidence | **Not completed** |
| Increased text size on core actions | **Not signed off** |
| Reduced motion | **Not audited** |

Do not classify pilot-ready until core next-step / Action Centre remain usable at large text sizes.

---

## 16. Usability testing

**Required before live patients — not yet executed.**

Recommended cohort: 3–5 internal non-engineering, 2–3 clinic staff, 3–5 controlled demonstration users.

Tasks: identify next action; open Action Centre; complete/acknowledge action; read timeline; find quote/document/pathology; return from notification; find support; log out.

Measure: completion, time, misclicks, confusion, support needed, navigation errors, next-step comprehension, confidence.

---

## 17. Pilot metrics scorecard

Track manually or via approved operational reports (not PHI analytics events):

- Activation: invitations, activations, rate, time-to-activate  
- Engagement: opens, Action Centre use, notification-to-screen, WAU, returns  
- Journey: actions completed, time-to-complete, overdue, pathology/docs/quote completion  
- Clinic impact: manual follow-ups, support requests, readiness blockers, chasing time, status enquiries, missed actions  
- Quality: crashes, API failures, deep-link failures, identity mismatches, incorrect state, duplicate notifications, incidents  
- Experience: ease, confidence, staff usefulness/trust, qualitative feedback  

---

## 18. Promotion gates (Operational Pilot → Deployed)

All mandatory gates must pass — no single percentage decision.

1. Clinical/identity safety: zero confirmed cross-patient/cross-tenant exposure; zero unresolved identity mismatches; no app-caused missed critical clinical action  
2. Technical reliability: critical flows pass; deep-link/crash thresholds met; completion reflects in FiOS; release/rollback proven; support/fallback proven  
3. Usability: most patients complete next action without help; Action Centre + timeline understood; a11y blockers resolved  
4. Operational: staff understand responsibilities; owners clear; escalation tested; withdrawal/deactivation work; privacy approved; distribution repeatable  
5. Evidence: pilot report, metrics, patient/clinic feedback, limitations documented, deployment scope approved  

---

## 19. Pause and rollback controls

**Pause immediately if:** wrong patient/tenant data; identity ambiguity; incorrect critical completion; missed critical requirement due to app failure; sensitive notification content; auth failures blocking patients; crash rate over threshold; support cannot manage cohort.

**Rollback actions:**

1. Stop new invitations  
2. Revoke affected access / unlink portal users  
3. Disable distribution of pilot builds  
4. Return communication to clinic fallback  
5. Preserve audit evidence  
6. Investigate before reactivation  

---

## 20. Website integration

| Surface | Change |
| --- | --- |
| `/platform/patient-app` | New product page |
| `/platform` | Module learn-more → patient-app |
| `/platform/progress` | `learnMoreHref: /platform/patient-app` |
| Homepage Patient App band | CTA → `/platform/patient-app` |
| Clinic Owners | Short module copy refreshed |
| Footer modules | FI Patient App link added |
| Sitemap | Entry added |
| Redirects | `/patient-app`, `/platform/patientos-app` |

---

## 21. Files changed

### follicleintelligence

- `app/platform/patient-app/page.tsx`
- `components/platform/PatientAppMarketingView.tsx`
- `components/marketing/PatientAppPhoneScreenshot.tsx`
- `lib/marketing/patientAppPageContent.ts`
- `lib/marketing/patientAppPageContent.test.ts`
- `lib/marketing/patientAppScreenshots.ts`
- `lib/marketing/platformProgressPageContent.ts` (+ test)
- `lib/marketing/homePageContent.ts`
- `lib/marketing/platformPageContent.ts`
- `lib/marketing/clinicOwnersPageContent.ts`
- `lib/seo/sitemap-pages.ts`
- `lib/site-navigation.ts`
- `next.config.mjs`
- `public/os-images/patient-app/*.webp`
- `scripts/patient-app-marketing-shots/*`
- `docs/marketing/screenshots/fi-patient-app-2a/*`
- `docs/marketing/fi-web-refresh-1j-patient-app.md`

### follicle-intelligence-patient

- `src/ui/EmergencyDisclaimer.tsx`
- `src/app/(app)/account/help.tsx`
- `src/app/(app)/account/index.tsx`
- `src/app/(app)/account/_layout.tsx`
- `src/app/(app)/index.tsx`
- `docs/patient-app/fi-patient-app-2a-public-page-and-pilot-readiness.md` (this file)

---

## 22. Screenshots and evidence

- Marketing inventory JSON under `docs/marketing/screenshots/fi-patient-app-2a/`
- PNG masters + WebP derivatives
- Capture script: `scripts/patient-app-marketing-shots/capture.cjs`

---

## 23. Tests and builds

Run / planned:

| Suite | Command / note |
| --- | --- |
| Patient App page invariants | `node --import tsx --test lib/marketing/patientAppPageContent.test.ts` |
| Progress registry | `node --import tsx --test lib/marketing/platformProgressPageContent.test.ts` |
| Patient App typecheck | `npm run typecheck` |
| Patient App proof | `npm run proof` |
| P1 client proof | `node scripts/p1-journey-control-client-proof.js` |
| FiOS Journey Control proof | `scripts/p1-journey-control-proof.ts` |
| FiOS typecheck / build | As available in CI |

---

## 24. Remaining blockers (before live invitations)

1. Assign clinic pilot owner and FI pilot owner  
2. Complete structured usability testing  
3. Complete accessibility smoke (VoiceOver/TalkBack + large text on core actions)  
4. Prove pause/rollback (feature flag or equivalent operator runbook with evidence)  
5. Prove patient deactivation / withdrawal end-to-end  
6. Confirm distribution build (TestFlight and/or Play internal) for the approved clinic devices  
7. Seed or approve a public-safe live demonstration tenant if future captures must come from a running app session  
8. Explicit written approval to invite real patients  

---

## 25. Commit hash

Record after commit in each repo. Placeholder until commits are created on request.

---

## 26. Final readiness label

**AMBER**

- Public product page: acceptance criteria for public readiness are met.  
- Controlled pilot: **not** READY FOR APPROVAL until §24 blockers clear.  
- Real patients must **not** be invited under this milestone.

---

## 27. FI-PATIENT-APP-2B follow-on

Canonical controlled-pilot approval packet:

`docs/patient-app/fi-patient-app-2b-controlled-pilot-approval.md`

2B closed product-control gaps (tenant pause, patient deactivation/withdrawal, push suppression, owner table, usability/a11y/support/metrics plans) but overall pilot verdict remains **AMBER** until clinic owner, human usability, device a11y, and native distribution proofs close. **No real patients invited.**
