# FI-DEMO-DAY-2A — Canonical Digital Twin Fixture and Patient Intelligence Overview

**Date:** 2026-08-07  
**Parent programme:** FI-DEMO-DAY-2 — Hair Restoration Digital Twin Showcase  
**Prior phase:** Phase 1 Demo Day — [docs/runbooks/fios-demo-day.md](../runbooks/fios-demo-day.md)  
**Status:** Implementation brief + build plan (planning only — no code in this document)

---

## 0. Verdict

Ship **one coherent showcase patient** (James Chen) on **both** demo packages, then reshape the existing **Health record** (`/patients/.../twin`) into a read-only **Patient Intelligence Overview** that tells the full lifecycle story in eight intelligence areas. That is the shortest path from “the demo data works” to “the audience understands why Follicle Intelligence is difficult to replace.”

---

## 1. Programme context (FI-DEMO-DAY-2)

### 1.1 Goal

Create one coherent showcase patient whose record moves through the complete intelligence lifecycle:

1. Lead and consultation  
2. HLI assessment and clinical risk profile  
3. Treatment or surgical recommendation  
4. Approved hairline and graft allocation  
5. Surgery-day clinical record  
6. HairAudit projected and observed outcomes  
7. Staff competencies and certifications  
8. Financial and operational performance  
9. Executive intelligence summary  

The demo must **tell a story**, not expose disconnected modules.

### 1.2 Package A — Enterprise command (IHRG / TITAN)

| Must show | Intent |
|-----------|--------|
| Multi-clinic oversight | Franchise command from one surface |
| Sydney’s live operational board | Demand → day-of operations |
| Revenue, deposits and conversion | Commercial spine |
| Surgical capacity and staffing | Theatre readiness |
| Clinical quality and outcome comparison | HairAudit-linked quality |
| Training and competency risks | Workforce gaps before they hit outcomes |
| Cross-clinic benchmarking | Sydney as the clean benchmark |

**Core message:** Manage an entire hair-restoration group from demand through to measurable patient outcomes.

### 1.3 Package B — Clinic-in-a-box (Follicle Demo Clinic)

| Must show | Intent |
|-----------|--------|
| A new clinic ready to operate | OnboardingOS sandbox → live ops |
| Services, doctors, clinical staff and rooms | Configured once |
| Leads and appointments already flowing | Day-one activity |
| Deposit and reception workflows | Money + front desk |
| One complete patient Digital Twin | Same James Chen story |
| Surgery, aftercare and outcome tracking | Lifecycle continuity |
| Path from operational setup to intelligence | Setup → Twin overview |

**Core message:** A clinic can begin with Follicle Intelligence and avoid assembling five disconnected systems.

### 1.4 Pivotal Demo Day screen

A **read-only Patient Intelligence Overview** (staff label: continue using **Health record**; presenters may say “Patient Intelligence Overview” / “Digital Twin” in speech only).

| Intelligence area | Demo content |
|-------------------|--------------|
| **Baseline** | History, photographs, trichoscopy and clinical risks |
| **Treatment** | Medication, PRP, exosomes and response |
| **Surgical plan** | Hairline, graft allocation, donor capacity and warnings |
| **Procedure** | Grafts, hairs, ratios, team, technique and transection |
| **Outcomes** | Projected result, observed growth, density and satisfaction |
| **Governance** | Consent, clinical approvals and audit history |
| **Workforce** | Staff involved and competencies valid on procedure date |
| **Economics** | Quote, deposit, procedure cost and contribution |

This is the tangible representation of the Hair Restoration Digital Twin for Demo Day.

---

## 2. Positioning (binding)

### 2.1 Product architecture names (use these)

Pitch and docs must use the **established** product architecture:

- **Follicle Intelligence OS** (FiOS / FI OS)
- **HLI**
- **HairAudit**
- **IIOHR**
- **Patient App**
- **ImagingOS** and the **shared projection foundation** (`@follicle/projection-core`)

### 2.2 Do **not** introduce as additional brands

Avoid introducing **LeadFlow**, **HairIntel**, **AuditOS**, and **AcademyOS** as customer-facing brands unless a deliberate renaming programme is approved. Too many names makes the platform appear fragmented — the opposite of the Demo Day message.

Internal module / table / route identifiers may retain `*OS` engineering names. Staff-facing copy continues to follow `src/lib/fiOs/ux/fiOsStaffTerminology.ts` (e.g. **Health record**, not “Digital Twin” / “Patient Twin” in UI chrome).

### 2.3 Presenter language vs UI copy

| Context | Preferred wording |
|---------|-------------------|
| Boardroom pitch / runbook speech | Hair Restoration Digital Twin, Patient Intelligence Overview |
| Staff UI heading / nav | Health record |
| Engineering | Patient Twin V1 / `patientTwin*` modules |

---

## 3. Locked decisions for 2A

| Decision | Choice |
|----------|--------|
| Deliverable type | Implementation brief + concrete file checklist (this doc) |
| Host surface | **Extend** existing Health record / Patient Twin route — not a parallel product page |
| Package coverage | **Both** Package A (Sydney / IHRG) and Package B (Follicle Demo Clinic) share one canonical story |
| Showcase persona | **James Chen, 42** — male Norwood 3V–4 surgical candidate |
| Package A home clinic | Sydney Hair Institute (`sydney-hair-institute`) |
| Package B home clinic | Follicle Demo Clinic — Main |
| Overview mode | Read-only; deep-links into existing workspaces for drill-down |
| Executive TITAN cards | **In scope for 2A** only as thin outcome / clinical-quality cards that **reference** James Chen’s outcomes — not a full GCC rewrite |
| Guided Demo Day route with presenter cues | **Stub / outline in 2A**; full guided chrome may land in 2B if timeboxed |
| Deterministic validation | **In scope for 2A** (dates, deposits, events, twin completeness) |

---

## 4. Showcase patient specification — James Chen

### 4.1 Identity (synthetic, deterministic)

| Field | Value |
|-------|--------|
| Display name | James Chen |
| Age | 42 |
| Sex | Male |
| Home market | Sydney, Australia |
| Staging | Norwood 3V → planned 4-adjacent recipient strategy |
| Lead source | Web enquiry → consult booked |
| Demo keys | `demo_patient_key: showcase-james-chen-v1` (Package A); `clinic_demo_patient_key: showcase-james-chen-v1` (Package B) |
| Idempotency | Same key re-seed must update / upsert, never duplicate |

Package A and Package B are **separate tenants**. They share the **same story spine and demo keys**, not the same `fi_patients.id`. Presenters treat them as parallel tellings of one product narrative.

### 4.2 Lifecycle spine (deterministic relative dates)

Anchor: **seed-time “today”** in `Australia/Sydney` (already used by Demo Day alignment and clinic demo).

| Phase | Relative timing | Artifacts to seed / assert |
|-------|-----------------|----------------------------|
| Lead | T−90d | CRM lead / enquiry → converted patient |
| Consultation | T−75d | Consultation completed; clinical notes; photos |
| HLI baseline | T−74d | Hair-loss classification, donor/recipient signals, risk flags |
| Medical / adjunct | T−60d → T−14d | Medication plan; optional PRP/exosome therapy events |
| Quote + deposit | T−45d / T−40d | Quote invoice; deposit paid (Package B: reception deposit widget) |
| Surgical plan | T−21d | Case plan; planned zones + graft allocation; approved hairline design |
| Consent / governance | T−14d | Consent + clinical approval events |
| Procedure | T−7d (or T−1d for “recent”) | Surgery completed: grafts, hairs, ratios, team, technique, transection |
| Immediate imaging | Procedure day | Protocol slots: front/left/right/top/crown/donor/post-op/graft tray |
| Projected outcome | Plan approval window | ImagingOS shared projection / HairAudit projection metadata (no live paid gen required) |
| Observed outcome | T−7d + 3m / 6m where historical | Outcome measurements + satisfaction |
| Workforce | Procedure date | Surgeon / nurse / tech assignments; competency valid-on-date flags |
| Economics | Quote → deposit → balance | Contribution visible on overview Economics strip |
| Executive roll-up | Always | Completeness ≥ target band; cited in TITAN quality card |

**Story rule:** Every row exists to advance James’s narrative. Avoid orphan demo noise on this patient.

### 4.3 Completeness target

Existing `calculatePatientTwinCompleteness` must score James at **band `excellent` (≥ 85)** after seed on both packages. Gaps that cannot be filled honestly must be listed in §10 (known limitations), not papered over with fake UI.

---

## 5. Patient Intelligence Overview — design brief

### 5.1 Route

Reuse:

`/fi-admin/{tenantId}/patients/{patientId}/twin`

Optional demo query (non-breaking):

`?demo=overview` or `?presentation=1`

When present: tighten layout for screen-share (section anchors, hide noisy edit affordances, show presenter cue rail if 2A ships the stub).

### 5.2 Information architecture (eight sections)

Replace the current “card collage” default order with a **story order**. Existing cards become section content or are deep-linked.

| # | Section id | Staff heading | Primary existing building blocks |
|---|------------|---------------|----------------------------------|
| 1 | `baseline` | Baseline | Identity, clinical, hair-loss classification, donor/recipient, imaging / photo protocol, pathology |
| 2 | `treatment` | Treatment | Medications / therapy; progression; checklist |
| 3 | `surgical_plan` | Surgical plan | Cases + planned zones / allocation / hairline (case deep-link + summary strip) |
| 4 | `procedure` | Procedure | Surgery rollup: grafts, team, technique, transection (from case/surgery loaders) |
| 5 | `outcomes` | Outcomes | Outcome journey, HairAudit / audit rollup, projected vs observed |
| 6 | `governance` | Governance | Audit card, consent / approval timeline events |
| 7 | `workforce` | Team on procedure day | Surgery team + competency validity (new thin section; may be metadata-first in 2A) |
| 8 | `economics` | Money | Quote / deposit / procedure cost / contribution (today only deep-links Payments — **must** surface inline summary in 2A) |

Header: patient name, clinic, lifecycle stage chip, completeness band, “Demo showcase” badge when metadata marks James.

### 5.3 Read-only contract

- No mutations from the overview.  
- CTAs are navigation only (“Open case plan”, “Open Payments”, “Open quality review”).  
- Presentation query must not enable write paths.

### 5.4 What 2A deliberately does **not** rebuild

- Full case Surgery Projection editor UX (already shipping under surgery projection 1B) — overview **summarises and links**.  
- Live OpenAI / paid projection generation.  
- Network-wide `fi_network_subjects` merge across IHRG + Follicle Demo Clinic.  
- Patient App patient-facing twin for James (may deep-link later).

---

## 6. Suggested build order (execution)

Aligned with programme recommendation; 2A owns steps 1–2 and the validation spine; steps 3–5 are started in 2A where cheap.

1. **Seed** one canonical showcase patient across existing modules (both packages).  
2. **Build** the consolidated Patient Intelligence Overview on Health record.  
3. **Add** thin executive outcome / clinical-quality cards to TITAN that cite James / Sydney quality.  
4. **Outline** guided Demo Day route with presenter cues (stub OK).  
5. **Add** deterministic validation for dates, deposits, events, tasks, and Digital Twin completeness.  
6. **Rehearse** at desktop and presentation-screen widths (manual checklist in runbook).

---

## 7. Workstreams and file checklist

### WS0 — Spec + constants (day 0)

| Action | Path / artifact |
|--------|-----------------|
| Canonical keys + persona constants | `src/lib/demo-day/showcaseJamesChenConstants.ts` (**new**) |
| Shared relative-date helpers | `src/lib/demo-day/showcaseTimeline.ts` (**new**) |
| Tests for keys / date math | `src/lib/demo-day/showcaseJamesChenConstants.test.ts` (**new**) |
| Keep this brief current | `docs/audits/FI-DEMO-DAY-2A.md` |

### WS1 — Package A fixture (IHRG / Sydney)

| Action | Path / artifact |
|--------|-----------------|
| Extend / compose seed after Demo Day alignment | `src/lib/ihrg-demo/ihrgShowcaseJamesChenSeed.server.ts` (**new**) |
| Wire into showcase profile | `src/lib/ihrg-demo/ihrgDemoSeed.server.ts` |
| CLI entry (or flag on existing) | `scripts/seed-ihrg-demo-data.ts` / `package.json` (`seed:ihrg-showcase`) |
| Prefer upsert via existing enterprise generators where possible | `src/lib/enterprise-demo/*` (patients, surgeries, imaging, financial) |
| Metadata markers | `enterprise_demo_showcase: true`, `demo_patient_key: showcase-james-chen-v1` |
| Hairline + allocation summary | Reuse FiOS case plan / `fi_case_hairline_designs` + planned_zones from surgery projection work |
| Pure specs tests | `src/lib/ihrg-demo/ihrgShowcaseJamesChenModel.test.ts` (**new**) |

**Constraint:** Do not break intentional TITAN anomalies on other clinics. James is Sydney’s **coherent excellence path**, not a rewrite of Dubai/Bangkok/London failure stories.

### WS2 — Package B fixture (Follicle Demo Clinic)

| Action | Path / artifact |
|--------|-----------------|
| Extend clinic seed | `src/lib/clinic-demo/clinicDemoShowcaseJamesChenSeed.server.ts` (**new**) |
| Wire after sandbox apply | `src/lib/clinic-demo/clinicDemoSeed.server.ts` |
| Constants | `src/lib/clinic-demo/clinicDemoConstants.ts` (add showcase key refs) |
| CLI | `scripts/seed-follicle-demo-clinic.ts` (already) |
| Tests | `src/lib/clinic-demo/clinicDemoShowcaseJamesChen.test.ts` (**new**) |

Package B must leave Reception “today” density intact and **add** James’s longitudinal record alongside the live board story.

### WS3 — Patient Intelligence Overview (UI)

| Action | Path / artifact |
|--------|-----------------|
| Section shell + anchors | `src/components/fi-admin/patientTwin/PatientIntelligenceOverview.tsx` (**new**) |
| Compose from existing cards / new strips | `src/components/fi-admin/patientTwin/PatientTwinDashboard.tsx` |
| Economics inline strip | `src/components/fi-admin/patientTwin/PatientTwinEconomicsStrip.tsx` (**new**) |
| Workforce strip | `src/components/fi-admin/patientTwin/PatientTwinWorkforceStrip.tsx` (**new**) |
| Surgical plan / procedure summaries | `src/components/fi-admin/patientTwin/PatientTwinSurgicalStoryStrips.tsx` (**new**) |
| Route + presentation query | `app/(fi-admin)/fi-admin/[tenantId]/patients/[patientId]/twin/page.tsx` |
| Optional presenter cue rail | `src/components/fi-admin/patientTwin/DemoDayPresenterCues.tsx` (**new**, stub OK) |
| Terminology: Health record chrome | `src/lib/fiOs/ux/fiOsStaffTerminology.ts` (no regression) |

### WS4 — Loader / DTO gaps (only what overview needs)

| Action | Path / artifact |
|--------|-----------------|
| Extend twin DTO if required | `src/lib/patientTwin/patientTwinTypes.ts` |
| Load economics summary (read) | `src/lib/patientTwin/patientTwinEconomics.server.ts` (**new**) |
| Load workforce-on-date summary | `src/lib/patientTwin/patientTwinWorkforce.server.ts` (**new**) |
| Wire into loader | `src/lib/patientTwin/patientTwinLoader.server.ts` |
| Completeness rules for new areas | `src/lib/patientTwin/patientTwinCompleteness.ts` |
| Schema validation | `src/lib/patientTwin/patientTwinSchema.ts` |

**Rule:** Prefer composing existing SoR tables over new migrations. Migrations are out of scope for 2A unless a true schema gap blocks idempotent seed (escalate before adding).

### WS5 — TITAN thin executive cards

| Action | Path / artifact |
|--------|-----------------|
| Outcome / clinical-quality card model | `src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreModel.ts` |
| Dashboard panel | Under `app/(fi-admin)/.../global-command-centre/` / existing GCC components |
| Presentation section beat | Presentation mode story — one beat linking Sydney quality → patient-level proof (James deep-link) |
| Keep validate script green | `scripts/validateEnterpriseDemoGlobalCommandCentre.ts` |

### WS6 — Deterministic validation

| Action | Path / artifact |
|--------|-----------------|
| Shared validators | `src/lib/demo-day/validateShowcaseDigitalTwin.ts` (**new**) |
| Package A CLI | `scripts/validate-demo-day-showcase.ts` (**new**) + `package.json` script `validate:demo-day-showcase` |
| Package B checks | Same script with `--package B` or dual-tenant resolve |
| Assert | Correct relative dates; deposit states; procedure team; hairline approved; outcome rows; completeness ≥ 85; demo keys present; no duplicate James rows |

### WS7 — Runbook + rehearsal

| Action | Path / artifact |
|--------|-----------------|
| Phase 2 script section | Update `docs/runbooks/fios-demo-day.md` |
| TITAN pointer | `docs/runbooks/titan-global-command-centre-demo.md` (optional one-liner) |
| Architecture note | `docs/architecture/enterprise-demo-environment.md` Future Phases |
| Manual size checklist | Desktop 1440 / 1920 presentation width |

---

## 8. npm scripts (target)

| Script | Purpose |
|--------|---------|
| `npm run seed:ihrg-showcase` | Already — must also materialise James after alignment |
| `npm run seed:follicle-demo-clinic` | Already — must also materialise James |
| `npm run validate:demo-day-showcase` | **New** — Digital Twin completeness + story spine |
| `npm run validate:titan-global-command-centre` | Existing — must remain green |

---

## 9. Acceptance criteria

### 9.1 Story

- [ ] Presenter can walk James Chen from lead → outcomes in **one** Health record screen without hopping modules first.  
- [ ] Package A and Package B tell the **same lifecycle story** with parallel demo keys.  
- [ ] Pitch speech uses §2 product names only (no LeadFlow / HairIntel / AuditOS / AcademyOS branding).

### 9.2 Data

- [ ] Idempotent re-seed does not duplicate James.  
- [ ] Completeness band `excellent` on both tenants.  
- [ ] Deposit + quote + surgery financial bundle exist and reconcile on overview Economics strip.  
- [ ] Approved hairline + graft allocation summary visible (or explicitly deep-linked with summary numbers).  
- [ ] Procedure team listed with competency-valid-on-date (metadata-first allowed).  
- [ ] Outcome projected + observed fields present (metadata / HairAudit / ImagingOS shared foundation — no paid gen required).

### 9.3 Surfaces

- [ ] Overview remains read-only.  
- [ ] Staff chrome says **Health record**; no prohibited architecture labels in UI.  
- [ ] TITAN shows at least one quality/outcome card that makes Sydney’s benchmark legible and links to proof.  
- [ ] `validate:demo-day-showcase` exits 0 on a freshly seeded demo project.

### 9.4 Demo Day rehearsal

- [ ] Package A 15–20 min script updated to include James overview after GCC / before or after Reception.  
- [ ] Package B script ends on James overview after Reception “today”.  
- [ ] Screen-share readable at 1920×1080 and laptop 1440 widths.

---

## 10. Known limitations / non-goals (2A)

| Item | Position |
|------|----------|
| Network subject unifying A+B James | Out of scope — separate tenants intentionally |
| Live SMS / email | Remains dry-run |
| Shared guest Auth logins | Phase 2+ still open |
| Paid photorealistic generation | Do not invoke; use seeded projection metadata / prior HA assets only |
| Full guided presenter chrome | Stub cues OK; polish in 2B |
| Pathology / inventory deep narrative | Optional; only if needed for completeness band |
| Renaming staff term Health record → Patient Intelligence Overview | Do **not** in 2A UI |

---

## 11. Subsequent tickets (suggested)

| ID | Focus |
|----|--------|
| **FI-DEMO-DAY-2B** | Guided Demo Day route, presenter cue polish, rehearsal automation |
| **FI-DEMO-DAY-2C** | TITAN workforce / training risk cards + cross-clinic outcome benchmarking depth |
| **FI-DEMO-DAY-2D** | Patient App glimpse of James (patient-safe subset) |
| **FI-DEMO-DAY-2E** | Imaging media pack alignment for James’s protocol slots (real placeholder JPEGs) |

---

## 12. Implementation slices (suggested PR sequence)

Prefer small MRs (GitLab conventional commits).

| Slice | Title | Soft boundary |
|-------|-------|---------------|
| **2A.1** | `feat(demo): James Chen constants + timeline helpers` | WS0 only |
| **2A.2** | `feat(demo): Package A Sydney James Chen showcase seed` | WS1 |
| **2A.3** | `feat(demo): Package B James Chen showcase seed` | WS2 |
| **2A.4** | `feat(patient): Patient Intelligence Overview sections on Health record` | WS3–WS4 |
| **2A.5** | `feat(titan): outcome quality card linking Sydney showcase` | WS5 |
| **2A.6** | `test(demo): validate:demo-day-showcase + runbook Phase 2` | WS6–WS7 |

---

## 13. Definition of done

2A is done when a sales engineer can:

1. `npm run seed:ihrg-showcase` and `npm run seed:follicle-demo-clinic`  
2. `npm run validate:demo-day-showcase` → green  
3. Open James’s Health record on either package and narrate baseline → economics without leaving the page first  
4. From TITAN, show network quality and land on the same patient-level proof for Sydney  

At that point Demo Day graduates from “modules seeded” to “replacement-hard story.”

---

## 14. Related docs

- [FiOS Demo Day Runbook (Phase 1)](../runbooks/fios-demo-day.md)  
- [TITAN Global Command Centre Demo](../runbooks/titan-global-command-centre-demo.md)  
- [Enterprise Demo Environment](../architecture/enterprise-demo-environment.md)  
- [Digital Twin Foundation Design](../architecture/digital-twin-foundation-design.md) (network substrate — not required for 2A fixture)  
- [FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B](./FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B.md) (hairline / allocation / projection SoR)  
