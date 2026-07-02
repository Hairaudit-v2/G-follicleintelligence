# FI OS Staff UAT Script — Sprint 9

Role-based walkthrough for real staff-style usage. Enable UAT helpers first:

```bash
FI_STAFF_UAT_MODE_ENABLED=1
```

UAT mode shows collapsible screen guides, “Was this clear?” feedback (stored via `staff.uat.feedback` events), and friction telemetry (`staff.uat.friction`) for wizard abandons, unresolved alerts, validation errors, and cross-module navigation.

**Tenant:** throwaway demo with `FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1`  
**Harness baseline:** `pnpm smoke:operational-day` must pass before manual UAT.

Record ratings and friction notes in [fi-os-sprint9-uat-findings.md](./fi-os-sprint9-uat-findings.md).

---

## Receptionist

**Goal:** Run the clinic day from arrival through consultation handoff.

| Step | Action | Pass criteria |
|------|--------|---------------|
| R1 | Open `/fi-admin/{tenant}/reception-board` | Board loads; UAT guide explains purpose (if mode on) |
| R2 | Read action alerts | Red/yellow alerts show human titles + “Resolve in calendar →” (or specific link) |
| R3 | Check in next scheduled patient | Button reads “Check in patient”; toast confirms |
| R4 | Advance queue | “Start consultation” → “Complete visit” labels; no dead-end after action |
| R5 | Empty day (if applicable) | “Open calendar” + “Find or add patient” CTAs visible |
| R6 | Live refresh | Timestamp updates without full-page reload |
| R7 | UAT feedback | Rate clarity 1–5 at bottom of screen |

**Exit:** Patient checked in and consultation completed (or correctly waiting) without developer explanation.

---

## Nurse

**Goal:** Support clinical flow — patient record, journey blockers, procedure day prep.

| Step | Action | Pass criteria |
|------|--------|---------------|
| N1 | Open patient from reception or search | Patient profile loads with journey ribbon |
| N2 | Read Patient Journey ribbon | Stage, % complete, recommended next step link |
| N3 | Clear journey blockers | Blocker chips link to fix screens where configured |
| N4 | Open `/procedure-day` (if `FI_PROCEDURE_DAY_ENABLED=true`) | Today’s surgeries listed; UAT guide visible |
| N5 | Review room/team coordination | Team labels and blockers readable on cards |
| N6 | Open WorkforceOS attention items | Critical queue items visible with severity badges |
| N7 | UAT feedback | Rate patient profile + procedure day clarity |

**Exit:** Nurse can see what the patient needs next and where to fix blockers.

---

## Doctor

**Goal:** Consultation completion, surgery planning context, calendar visibility.

| Step | Action | Pass criteria |
|------|--------|---------------|
| D1 | Complete consultation from reception queue | Status advances; patient record reflects visit |
| D2 | Open patient profile → clinical tab | History, consultations, procedures accessible |
| D3 | Open `/calendar` for today | Surgery/consult cards show readiness/blockers on card |
| D4 | Open surgery booking drawer from calendar | Staff/room assignment possible from drawer |
| D5 | Review surgery readiness | Blocker chips deep-link to readiness or calendar |
| D6 | UAT feedback | Rate calendar clarity |

**Exit:** Doctor can finish consult and see scheduling blockers without asking engineering.

---

## Surgery coordinator

**Goal:** Book surgery end-to-end with deposit, room, and surgeon captured.

| Step | Action | Pass criteria |
|------|--------|---------------|
| SC1 | Open patient → journey “book surgery” path | Lands on surgery booking wizard or calendar prefill |
| SC2 | Wizard step 1–4 | Progress bar; requirements list when fields missing |
| SC3 | Use “Find next available slots” | Suggested slots populate date/room |
| SC4 | Confirm booking | Success screen with next actions + pre-op checklist |
| SC5 | Verify calendar + reception | Surgery appears; blockers clear when staff/room set |
| SC6 | Cancel mid-wizard (test friction) | “Cancel booking” returns to patients; friction logged |
| SC7 | UAT feedback | Rate wizard clarity |

**Exit:** Surgery booked with deposit path understood; no silent failure on step 4.

---

## Finance / admin

**Goal:** Payment visibility, workforce compliance, operational oversight.

| Step | Action | Pass criteria |
|------|--------|---------------|
| A1 | Reception board payment badges | Yellow/red payment states visible on schedule cards |
| A2 | Patient profile → payments tab | Invoice/deposit status readable |
| A3 | Open `/workforce-os` | KPI strip, attention queue, surgical intelligence panels load |
| A4 | Follow attention queue link | Lands on staffing/compliance fix screen (not 404) |
| A5 | Financial dashboard (if `FI_PAYMENTS_ENABLED`) | KPIs gated message clear when payments off |
| A6 | Cross-module navigation | Moving reception → calendar → patient does not dead-end |
| A7 | UAT feedback | Rate workforce OS clarity |

**Exit:** Admin can trace payment + staffing risks and navigate to fix screens.

---

## Friction signals to watch

| Signal | Where logged | Staff trigger |
|--------|--------------|---------------|
| `wizard_step_abandoned` | Surgery wizard | Cancel booking before confirm |
| `wizard_validation_error` | Surgery wizard | Missing requirements / submit error |
| `alert_opened_unresolved` | Reception board | Click action alert (tracks opens) |
| `navigation_module_bounce` | Global (UAT provider) | Rapid switches between modules |
| `staff.uat.feedback` | All key screens | “Was this clear?” rating + comment |

---

## Sign-off

| Role | Tester | Date | Result |
|------|--------|------|--------|
| Receptionist | | | |
| Nurse | | | |
| Doctor | | | |
| Surgery coordinator | | | |
| Finance / admin | | | |
| Engineering (automated) | Harness | | |