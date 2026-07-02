# WorkforceOS UI Cohesion — Implementation Plan

**Date:** July 2026  
**Companion:** [workforce-uix-cohesion-audit.md](./workforce-uix-cohesion-audit.md)  
**Goal:** One cohesive staff lifecycle system without removing backend functionality.

---

## Target information architecture

```
Workforce Command Centre (/workforce-os)
├── Urgent actions queue → deep links to blocker surfaces
├── Readiness / access / onboarding / compliance / roster KPIs
└── Module tiles (planning, payroll, recruitment, …)

Staff Directory (/staff)
├── All fi_staff records
├── Primary CTA: Start onboarding → /hr-os/onboarding
├── Secondary: Staff Access, Command Centre
└── Rows → Staff Profile (future unified profile)

Staff Profile (/workforce-os/staff/{id} — extended)
├── Overview — unified StaffStatusCard
├── Access — embedded Staff Access row
├── Onboarding — checklist + invite actions
├── Documents — credentials + IIOHR snapshot
├── Training — assignment status + links
├── SOPs — acknowledgement status
├── Roster — availability + next shifts
└── Audit history — identity audit timeline

Onboarding Centre (/hr-os/onboarding)
└── New hires only: create, invite, checklist, manager approval

Staff Access Centre (/workforce-os/staff-access)
└── Operational login/PIN queue (also embedded in profile Access tab)

Specialised centres (unchanged routes, improved cross-links)
├── HR OS Compliance, Credentials, Certifications
├── Roster Command Centre
└── Staff Identity Readiness Audit (add to nav)
```

---

## Phased delivery

### Phase 0 — Immediate confusion fixes ✅ (this sprint)

| Task | Status | Notes |
|------|--------|-------|
| Rename Directory “Add staff” → “Start onboarding” | ✅ Done | `StaffDirectorySecondaryView` |
| Route primary CTA to Onboarding Centre | ✅ Done | `buildStaffDirectoryPrimaryActionHref` |
| Lifecycle guidance copy | ✅ Done | `staffDirectoryLifecycleGuidance()` |
| Cross-links: Directory → Onboarding, Staff Access, Command Centre | ✅ Done | Header + guidance card |
| Empty state guidance | ✅ Done | Points to Onboarding Centre |
| `staffLifecycleUxCore.ts` — status + action resolution | ✅ Done | Pure functions + tests |
| `StaffStatusCard.tsx` — reusable presentational component | ✅ Done | Ready for profile/directory adoption |

**Not changed (intentionally):** inline edit for existing staff; all server actions; token accept flows.

### Phase 1 — Navigation & labelling (1 sprint)

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 1.1 | Add **Staff Identity Audit** to `WorkforceOsSubNav` | `WorkforceOsSubNav.tsx` | Route discoverable from Team area |
| 1.2 | Add **Roster Command Centre** to `HrOsSubNav` | `HrOsSubNav.tsx` | Roster in pill nav |
| 1.3 | Fix mislabeled “Workforce Command Centre” links pointing to `/staff` | `hr-os/page.tsx`, `OffboardingCentreClient.tsx` | All link to `/workforce-os` |
| 1.4 | Align dashboard **Team** card with sidebar Team destination | `DashboardModuleNavigation.tsx` | Single Team entry point or clear labels (“HR dashboard” vs “Workforce”) |
| 1.5 | Rename settings route label: **Staff entitlements** vs **Staff Access** | `FiOsClinicSettingsNav.tsx`, settings page title | No name collision in nav |
| 1.6 | Standardise copy dictionary | New `staffLifecycleCopy.ts` or extend UX core | Workforce / Onboarding / Access / Readiness terms |
| 1.7 | Remove or archive orphaned `WorkforceCommandCentreView.tsx` | `src/components/fi/staff/` | No dead “Add staff” in codebase |

### Phase 2 — Unified Staff Profile (2 sprints)

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 2.1 | Tab shell on WorkforceOS staff profile | `WorkforceOsStaffProfileClient.tsx` | Tabs: Overview, Access, Onboarding, Documents, Training, SOPs, Roster, Audit |
| 2.2 | Server loader aggregating cross-domain staff state | New `staffProfileHub.server.ts` | Single loader: employment, access, onboarding, readiness, roster snippet |
| 2.3 | Mount `StaffStatusCard` on Overview | Profile client | All status dimensions visible |
| 2.4 | Embed onboarding checklist panel | Reuse `OnboardingCentreClient` row logic | Per-staff onboarding tab |
| 2.5 | Embed access actions panel | Extract from `StaffAccessCentreClient` | Same actions, profile context |
| 2.6 | Bridge Staff Twin ↔ WorkforceOS profile | Bidirectional links when `fi_staff_id` linked | One click between operational and lifecycle views |
| 2.7 | Redirect strategy for Staff Twin | Optional: Twin becomes read-only “clinical view” tab | Document decision in ADR |

### Phase 3 — Staff Action Menu component (1 sprint)

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 3.1 | `StaffActionMenu.tsx` — dropdown using `resolveOnboardingCentreActions` + `resolveStaffAccessCentreActions` | New component | Context-aware actions |
| 3.2 | Wire to Directory rows, Access Centre, Profile, Command Centre queue | Multiple consumers | Consistent labels and visibility |
| 3.3 | Deep link hrefs for each action id | UX core extension | Identity audit recommendations clickable |
| 3.4 | Suspended staff guidance panel | UX core + component | No resend invite when suspended |

### Phase 4 — Workforce Command Centre as lifecycle hub (1–2 sprints)

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 4.1 | **Urgent actions queue** aggregating blockers | Extend `WorkforceCommandCentreClient` or new server loader | Onboarding, access, compliance, roster gaps |
| 4.2 | Each queue item links to correct surface + staff | Deep links with staff id query param | Click fixes → right page |
| 4.3 | Port attention queue pattern from legacy `WorkforceCommandCentreView` | Reference orphaned component | Per-staff cards with StaffStatusCard |
| 4.4 | KPI alignment with Identity Audit summary | Shared metrics function | Consistent counts across surfaces |

### Phase 5 — Compliance / Training / SOP person-centric surfacing (2 sprints)

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 5.1 | Profile Documents tab — credentials + IIOHR documents missing count | Links to HR OS credentials |
| 5.2 | Profile Training tab — readiness engine training factors + onboarding training flag | Assign training CTA → HR or onboarding |
| 5.3 | Profile SOPs tab — acknowledgement status from readiness engine | Read-only until SOP admin UI exists |
| 5.4 | Optional: lightweight SOP acknowledgement list UI | Only if product prioritises |

### Phase 6 — Tests & polish (ongoing)

| Test | Location | Status |
|------|----------|--------|
| Directory primary action → onboarding | `staffLifecycleUxCore.test.ts` | ✅ |
| Unified status dimensions | `staffLifecycleUxCore.test.ts` | ✅ |
| Pending → Resend invite | `staffLifecycleUxCore.test.ts` | ✅ |
| Accepted → Reset PIN, not Resend | `staffLifecycleUxCore.test.ts` | ✅ |
| Suspended → guidance, no invite | `staffLifecycleUxCore.test.ts` | ✅ |
| Command Centre blocker links | TBD Phase 4 | Pending |
| E2E: Start onboarding navigation | Playwright journey | Recommended Phase 1 |
| Profile tab renders all states | Component tests Phase 2 | Pending |

---

## User journey maps

### Journey 1: Add a new staff member

| Step | Before | After Phase 0 | After Phase 2 |
|------|--------|---------------|---------------|
| 1 | Admin unsure: Directory “Add staff” or Onboarding? | Directory → **Start onboarding** | Same |
| 2 | May create `fi_staff` only | Onboarding Centre create | Profile created in onboarding |
| 3 | Separate path to send invite | Send invite on same page | Profile Onboarding tab |
| 4 | Check PIN elsewhere | Onboarding checklist | Profile Access tab |
| 5 | Readiness unknown | Multiple pages | Profile Overview StaffStatusCard |

### Journey 2: Resend missed invite

| Context | Path |
|---------|------|
| New hire, onboarding invite | Onboarding Centre → Resend (or Profile → Onboarding tab) |
| Existing staff, login invite | Staff Access Centre → Resend (or Profile → Access tab) |
| Suspended | Staff Access → reactivation guidance — **no resend** |

### Journey 3: Set / reset PIN

| Actor | Path |
|-------|------|
| Staff (first time) | Onboarding or Access accept flow → PIN setup token |
| Staff (forgot) | Admin: Staff Access → Reset PIN |
| Admin override | Staff Directory edit or Staff Twin → `StaffPinSettingsPanel` |

### Journey 4: Check if staff is ready to work

| Before | After target |
|--------|--------------|
| Directory pills + Twin + Identity Audit + Readiness export | **Staff Profile Overview** — single StaffStatusCard + readiness breakdown |
| Command Centre aggregate KPIs | Command Centre queue item → Profile |

### Journey 5: Fix missing documents

| Path |
|------|
| Profile Documents tab → HR OS Credentials / IIOHR portal link |
| Command Centre compliance blocker → Profile Documents |

### Journey 6: Assign training

| Path |
|------|
| Onboarding Centre “Mark training done” (manual) |
| Profile Training tab → link to HR training (future assignment engine UI) |

### Journey 7: Check clinical eligibility

| Path |
|------|
| Roster candidate list (server eligibility) |
| Profile Roster tab + readiness engine clinical factors |
| Command Centre clinical eligibility KPI |

### Journey 8: Roster staff for surgery day

| Path | Unchanged |
|------|-----------|
| Roster Command Centre → select event → Assignment Editor | Keep specialised |

### Journey 9: Suspend / revoke access

| Path | Unchanged |
|------|-----------|
| Staff Access Centre → Suspend / Revoke | Keep; embed in Profile Access tab |

---

## Shared components specification

### StaffStatusCard

**Location:** `src/components/fi/workforce/StaffStatusCard.tsx`  
**Input:** `StaffUnifiedStatusSnapshot` from `resolveStaffUnifiedStatus()`  
**Variants:** `compact` (directory rows), full (profile overview)  
**Adoption plan:**

1. Phase 2 — WorkforceOS profile Overview
2. Phase 4 — Command Centre attention queue cards
3. Phase 2 — Optionally replace Directory row pills (merge with existing readiness/compliance)

### StaffActionMenu (Phase 3)

**Logic:** `staffLifecycleUxCore.ts` — `resolveOnboardingCentreActions`, `resolveStaffAccessCentreActions`  
**UI:** Dropdown menu with `FiOsPendingActionButton` for async actions  
**Context prop:** `surface: "onboarding" | "access" | "profile"`  
**Rules:**

| State | Visible actions |
|-------|-----------------|
| No invite, new hire | Send invite |
| Pending/expired onboarding invite | Resend, Copy link |
| Login active | Reset PIN, Suspend, Revoke |
| Pending login invite | Resend, Copy link |
| Suspended/revoked | Guidance only + review in Staff Access |
| Departed/archived | View profile only |

---

## Copy standards (Phase 1 dictionary)

| Use | Label | Avoid |
|-----|-------|-------|
| Operating area | **Workforce** | HR OS (in staff-facing flows) |
| New hire setup | **Onboarding** | “Add staff”, “Create staff” (primary CTAs) |
| Login / PIN / security | **Access** | “Staff Access & Entitlements” for settings |
| Operational readiness | **Readiness** | “Staff readiness export” in user flows |
| Executive landing | **Workforce Command Centre** | Using for `/staff` directory |
| Settings grants | **Staff entitlements** | “Staff Access” |

**Empty states:**

- “New staff start in Onboarding.”
- “Access is managed in Staff Access.”
- “Readiness combines documents, training, SOPs, permissions, identity, and roster eligibility.”

---

## Technical constraints

1. **Two staff tables** — `fi_staff` (scheduling/settings) and `fi_staff_members` (lifecycle). Profile hub loader must join via `fi_staff_id`.
2. **Two invite systems** — onboarding vs login invitations; action menu must never cross-wire actions.
3. **IIOHR** — documents/training/SOP source of truth external; FI surfaces read-only snapshots + links.
4. **RBAC** — reuse `canManage` patterns; action menu respects same flags as existing centres.
5. **Navigation pending** — all async staff actions use `FiOsPendingActionButton` + provider.

---

## Success metrics

| Metric | Measurement |
|--------|-------------|
| Time to send first invite (new hire) | User test: Directory → Onboarding → Send |
| Admin confusion reports | Support tickets re “where to add staff” |
| Pages visited to answer readiness | Target: 1 (Profile Overview) |
| Identity Audit usage | Page views after nav addition |
| Duplicate staff creates | Monitor `fi_staff` creates without `fi_staff_members` link |

---

## Sprint checklist (Phase 0 completion)

- [x] Audit document
- [x] Implementation plan
- [x] Staff Directory immediate fixes
- [x] `staffLifecycleUxCore` + tests
- [x] `StaffStatusCard` component (foundation)
- [ ] Phase 1 nav fixes (next sprint)
- [ ] Unified Staff Profile tabs (Phase 2)
- [ ] StaffActionMenu UI (Phase 3)

---

## Completion report reference

See audit document § “Immediate fixes applied” and user journey before/after tables above. Phase 0 reduces the primary confusion vector (competing create path) and establishes shared UX primitives for subsequent phases.
