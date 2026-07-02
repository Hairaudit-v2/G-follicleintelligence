# FI OS Staff UAT Script

**Canonical guide:** [fi-ux-audit/05-operator-guide.md](./fi-ux-audit/05-operator-guide.md)  
**Labels & routes:** [fi-ux-audit/02-ui-terminology-dictionary.md](./fi-ux-audit/02-ui-terminology-dictionary.md)

Enable UAT helpers:

```bash
FI_STAFF_UAT_MODE_ENABLED=1
```

UAT mode shows collapsible screen guides, “Was this clear?” feedback, and friction telemetry.

**Tenant:** throwaway demo with `FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1`  
**Harness:** `pnpm smoke:operational-day` must pass before manual UAT.

Record findings in [fi-os-real-clinic-uat-checklist.md](./fi-os-real-clinic-uat-checklist.md).

---

## Receptionist

**Goal:** Run the clinic day from arrival through consultation handoff.

| Step | Action | Pass criteria |
|------|--------|---------------|
| R1 | Open `/fi-admin/{tenantId}/reception` (sidebar **Reception board**) | H1 "Reception Board"; UAT guide if mode on. *Not* `/reception-board` (command center). |
| R2 | Read action alerts | Red/yellow alerts show human titles + resolve link |
| R3 | **Check in patient** on next arrival | Toast confirms; lane → **Checked in** |
| R4 | **Start consultation** → **Complete visit** | Labels exact; no dead-end after action |
| R5 | Empty day | **Open Calendar** + patient find CTAs visible |
| R6 | **Live refresh** | Timestamp updates without full-page reload |
| R7 | UAT feedback | Rate clarity 1–5 |

**Exit:** Patient checked in and visit completed without developer explanation.

---

## Nurse

**Goal:** Patient record, journey blockers, procedure day prep.

| Step | Action | Pass criteria |
|------|--------|---------------|
| N1 | Global search or reception → patient | Profile loads with journey ribbon |
| N2 | Patient Journey ribbon | Stage, % complete, recommended next step |
| N3 | Blocker chips | Deep-link to fix screens where configured |
| N4 | Sidebar **Cases** → **Procedure day** | Today's surgeries listed (`FI_PROCEDURE_DAY_ENABLED`) |
| N5 | Procedure cards | Team labels and blockers readable |
| N6 | Sidebar **WorkforceOS** | Critical queue items with severity badges |
| N7 | UAT feedback | Rate patient profile + procedure day |

**Exit:** Nurse sees patient next steps and today's procedures.

---

## Doctor

**Goal:** Consultation completion, surgery context, calendar visibility.

| Step | Action | Pass criteria |
|------|--------|---------------|
| D1 | **Start consultation** / **Complete visit** on reception board | Status advances |
| D2 | Patient profile → clinical sections | History, consultations accessible |
| D3 | Sidebar **Calendar** | Surgery/consult cards show readiness on card |
| D4 | Booking drawer from calendar | Staff/room assignment possible |
| D5 | Sidebar **Cases** → **Readiness board** | Blocker chips deep-link |
| D6 | UAT feedback | Rate calendar clarity |

**Exit:** Doctor finishes consult and sees scheduling blockers unaided.

---

## Surgery coordinator

**Goal:** Book surgery with deposit, room, surgeon.

| Step | Action | Pass criteria |
|------|--------|---------------|
| SC1 | Patient journey → book surgery | Wizard or calendar prefill |
| SC2 | Wizard steps 1–4 | Progress bar; requirements when fields missing |
| SC3 | **Find next available slots** | Suggested slots populate date/room |
| SC4 | Confirm booking | Success screen + pre-op checklist |
| SC5 | **Readiness board** | Blockers clear or linked to calendar |
| SC6 | UAT feedback | Rate wizard clarity |

**Exit:** Surgery booked end-to-end.

---

## CRM operator

**Goal:** Capture enquiry and schedule follow-up.

| Step | Action | Pass criteria |
|------|--------|---------------|
| C1 | Quick create → **New enquiry** | LeadFlow create form opens |
| C2 | Create lead | Appears in pipeline |
| C3 | Quick create → **New task** | CRM workspace → lead Timeline |
| C4 | Global search | Patient/case first; leads appear after defer |
| C5 | UAT feedback | Rate LeadFlow clarity |

**Exit:** Enquiry captured with task scheduled.

---

## Clinic manager

**Goal:** Day oversight without patient-level drill-down.

| Step | Action | Pass criteria |
|------|--------|---------------|
| M1 | Sidebar **Operations centre** | Day snapshot loads |
| M2 | Sidebar **ReceptionOS** | KPIs readable |
| M3 | Sidebar **Reception board** | Flow lanes match ops snapshot |
| M4 | Sidebar **Analytics** | Metrics load (if role allows) |
| M5 | UAT feedback | Rate ops centre clarity |

**Exit:** Manager assesses clinic day health in under 5 minutes.