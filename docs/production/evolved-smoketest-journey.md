# Evolved Hair Restoration — Smoketest Journey

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Purpose:** Single end-to-end SMOKETEST journey template — lead through analytics closure  
**Convention:** Prefix all test records with `SMOKETEST-` per [clinic readiness runbook](../smoke/fi-os-clinic-readiness-runbook.md)  
**Status:** Template — do not mark Pass without evidence  
**Last updated:** To verify

**Related docs**

- [Workflow matrix](./evolved-workflow-matrix.md) — module/table reference
- [Operational validation framework](./evolved-operational-validation.md) — per-OS steps
- [Production blockers](./evolved-production-blockers.md)
- [Go/no-go checklist](./evolved-go-no-go-checklist.md)

---

## Journey metadata

| Field | Value |
|-------|-------|
| **Journey ID** | SMOKETEST-JOURNEY-001 |
| **Operator** | To verify |
| **Date** | To verify |
| **Environment URL** | To verify |
| **Tenant ID** | `EVOLVED_PERTH_TENANT_ID` (confirm in Vercel — do not paste UUID here) |
| **Staff session** | To verify (real `fi_users` row) |
| **Overall result** | ☐ Pass · ☐ Fail · ☐ Partial (Accepted risk) |

**Linked records (fill as journey progresses):**

| Entity | SMOKETEST- ID |
|--------|---------------|
| Lead | To verify |
| Booking (consult) | To verify |
| Consultation | To verify |
| Patient | To verify |
| Case | To verify |
| Payment record | To verify |
| Booking (surgery) | To verify |
| HairAudit / outcome ref | To verify |

---

## Step 1 — Lead Created

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-LEAD-001 |
| **Module** | LeadFlow |
| **Action** | Authenticate as CRM operator; open `/fi-admin/[tenantId]/crm`; create lead with source, stage, contact fields; move through ≥2 pipeline stages; add note/task |
| **Expected result** | Lead visible in Evolved tenant only; stage history appended; activity feed shows create/update events |
| **DB evidence** | `fi_crm_leads` (and/or `fi_leads` — **To verify** which Evolved uses); `fi_crm_lead_stage_history`; `fi_crm_activity_events` (`lead.created`, `lead.updated`); optional `fi_crm_notes`, `fi_crm_tasks` |
| **UI evidence** | Screenshot: lead detail + pipeline stage + activity feed |
| **External integration evidence** | HubSpot: N/A or dry-run only (BLK-X-01); reminder cron: `fi_reminder_jobs` if `lead.created` triggers — **To verify** |
| **Pass / Fail** | To verify |
| **Notes** | BLK-X-03: confirm which lead model is SoR for Evolved |

---

## Step 2 — Consultation Booked

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-BOOK-CONSULT-001 |
| **Module** | CalendarOS |
| **Action** | Create FI-native booking linked to lead/patient; assign room/staff if configured; confirm Perth timezone on calendar views |
| **Expected result** | Booking created in FI; list and calendar views update; **no assumption** that Google staged approve creates bookings |
| **DB evidence** | `fi_bookings`; optional `fi_booking_resource_requirements`; `fi_crm_activity_events` (`booking.created`) |
| **UI evidence** | Screenshot: calendar + booking detail |
| **External integration evidence** | If Google connected: `fi_calendar_sync_health`, staged queue — approve must **not** create `fi_bookings` (BLK-CAL-01); Timely N/A or webhook secret verified |
| **Pass / Fail** | To verify |
| **Notes** | Manual FI booking is source of record |

---

## Step 3 — Consultation Completed

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-CONSULT-001 |
| **Module** | ConsultationOS |
| **Action** | Open consultation linked to booking; complete required form(s); mark consultation complete |
| **Expected result** | Consultation status complete; form instances saved; optional automation handoff per tenant policy |
| **DB evidence** | `fi_consultations`; consultation form instance tables; `fi_crm_activity_events` |
| **UI evidence** | Screenshot: completed consultation + forms |
| **External integration evidence** | OpenAI checklist AI — N/A unless enabled (**To verify**) |
| **Pass / Fail** | To verify |
| **Notes** | Workflow engine v1 handlers are placeholders (BLK-X-02) |

---

## Step 4 — Patient Created

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-PATIENT-001 |
| **Module** | PatientOS (+ LeadFlow conversion) |
| **Action** | Execute lead → person/patient conversion (or confirm patient from consult path); verify patient in directory |
| **Expected result** | Single patient record; no duplicate person; retrievable from CRM and PatientOS |
| **DB evidence** | `fi_persons`, `fi_person_roles`, `fi_patients`, `fi_patient_clinical_details`, `fi_patient_source_ids`, `fi_timeline_events`, `fi_crm_activity_events` |
| **UI evidence** | Screenshot: patient profile |
| **External integration evidence** | HLI ingest via `/api/fi/events` only if BLK-LEG-01 decision enables legacy API |
| **Pass / Fail** | To verify |
| **Notes** | Cross-tenant visibility = **P0 stop** |

---

## Step 5 — Images Uploaded

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-IMG-001 |
| **Module** | ImagingOS (PatientOS UI) |
| **Action** | Upload test image(s) to patient; confirm display in patient imaging view |
| **Expected result** | Image stored and visible; tenant-scoped signed URLs work |
| **DB evidence** | `fi_patient_images`; Supabase Storage object path |
| **UI evidence** | Screenshot: uploaded image in patient record |
| **External integration evidence** | HairAudit classify endpoint — only if explicitly tested; IM-1 stub by default |
| **Pass / Fail** | To verify |
| **Notes** | Do not expect live AI classification unless IM-12 activated |

---

## Step 6 — Treatment Plan Created

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-PLAN-001 |
| **Module** | ConsultationOS + SurgeryOS |
| **Action** | Create or confirm case; create/update surgery plan / quote as Evolved workflow requires |
| **Expected result** | Plan visible on case; commercial quote linked if used |
| **DB evidence** | `fi_case_surgery_plans`, `fi_cases`, optional `fi_crm_quotes` |
| **UI evidence** | Screenshot: case + surgery plan |
| **External integration evidence** | None required |
| **Pass / Fail** | To verify |
| **Notes** | Surgery plan may not appear on patient timeline feed (BLK-X-04) |

---

## Step 7 — Deposit Recorded

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-DEPOSIT-001 |
| **Module** | FinancialOS |
| **Action** | Record manual deposit in `fi_payment_records` against quote/case; **do not** treat as live card capture unless Stripe validated |
| **Expected result** | Payment record visible; staff understand manual scope; pathway inbox updated if applicable |
| **DB evidence** | `fi_payment_records`; optional `fi_financial_transactions`, `fi_revenue_pipeline` |
| **UI evidence** | Screenshot: payment record create flow |
| **External integration evidence** | Stripe webhook — **off** for FI-PH1 unless BLK-FIN-03 validated |
| **Pass / Fail** | To verify |
| **Notes** | BLK-FIN-01: manual tracking only |

---

## Step 8 — Surgery Booked

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-BOOK-SURG-001 |
| **Module** | CalendarOS + SurgeryOS |
| **Action** | Apply **manual deposit clearance gate** (BLK-FIN-02); create surgery booking linked to case/patient |
| **Expected result** | Surgery booking created only after clearance checklist signed; room/staff eligibility respected |
| **DB evidence** | `fi_bookings` (surgery service type); `fi_cases`, `fi_case_procedures`; `fi_crm_activity_events` |
| **UI evidence** | Screenshot: surgery booking + clearance note |
| **External integration evidence** | Google mirror optional — FI booking remains SoR |
| **Pass / Fail** | To verify |
| **Notes** | Automated deposit gate not enforced — manual SOP required |

---

## Step 9 — Procedure Day Executed

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-PROC-001 |
| **Module** | SurgeryOS (+ WorkforceOS) |
| **Action** | Dry-run or simulated procedure day: team assignment, milestones, graft session if applicable; **manual AcademyOS privilege check** |
| **Expected result** | Procedure milestones recorded; team columns populated per V1.1 migration |
| **DB evidence** | `fi_case_procedures`, `fi_surgery_graft_sessions`, `fi_surgery_graft_count_events`, `fi_staff_event_assignments` |
| **UI evidence** | Screenshot: procedure day view |
| **External integration evidence** | None required for core path |
| **Pass / Fail** | To verify |
| **Notes** | BLK-ACA-01: manual privilege verification; migration `20260718120002_fi_case_procedures_v11_team_milestones.sql` required |

---

## Step 10 — Post-op Review Completed

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-POSTOP-001 |
| **Module** | SurgeryOS + PatientOS |
| **Action** | Record post-op review / tracking; optional follow-up imaging |
| **Expected result** | Post-op tracking row saved; patient record updated |
| **DB evidence** | `fi_case_post_op_tracking`; optional `fi_patient_images`, `fi_patient_therapy_plans` (MedicationOS partial) |
| **UI evidence** | Screenshot: post-op review |
| **External integration evidence** | ReceptionOS follow-up — dry-run only for FI-PH1 (BLK-REC-01) |
| **Pass / Fail** | To verify |
| **Notes** | MedicationOS therapy timeline partial (BLK-MED-01) |

---

## Step 11 — HairAudit / Outcome Evidence Linked

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-HAIRAUDIT-001 |
| **Module** | AuditOS (+ external HairAudit) |
| **Action** | Link outcome evidence: ingest event, manual case link, or document N/A if HairAudit not in scope for this journey |
| **Expected result** | Case/timeline shows audit linkage or explicit N/A with BLK-LEG-01 decision |
| **DB evidence** | `fi_events`, `fi_event_links`, `fi_cases`, optional `fi_media_assets`, `fi_timeline_events`, `fi_scorecards`, `fi_reports` |
| **UI evidence** | Screenshot: case audit / timeline linkage |
| **External integration evidence** | `POST /api/fi/events` with HairAudit events — **only if** legacy API enabled per go/no-go |
| **Pass / Fail** | To verify |
| **Notes** | High risk if legacy API enabled without rotation (BLK-LEG-01) |

---

## Step 12 — Analytics Updated

| Field | Value |
|-------|-------|
| **Test record ID** | SMOKETEST-ANALYTICS-001 |
| **Module** | AnalyticsOS |
| **Action** | Query analytics for journey module events; compare to CRM activity feed |
| **Expected result** | Partial analytics emission acceptable if acknowledged (BLK-X-05); document which steps emitted vs did not |
| **DB evidence** | `fi_analytics_events` filtered by tenant + SMOKETEST- window; parallel `fi_crm_activity_events` |
| **UI evidence** | Screenshot: analytics dashboard if available |
| **External integration evidence** | Intelligence Bus — **off** in production (BLK-INT-01); no `fi_intelligence_event_logs` persistence expected |
| **Pass / Fail** | To verify |
| **Notes** | Acknowledge incomplete module publishers |

---

## Journey summary

| Step | Test record ID | Pass / Fail | Blocker refs | Evidence attached |
|------|----------------|:-----------:|--------------|:-----------------:|
| 1 Lead Created | SMOKETEST-LEAD-001 | To verify | BLK-X-03 | ☐ |
| 2 Consultation Booked | SMOKETEST-BOOK-CONSULT-001 | To verify | BLK-CAL-01 | ☐ |
| 3 Consultation Completed | SMOKETEST-CONSULT-001 | To verify | BLK-X-02 | ☐ |
| 4 Patient Created | SMOKETEST-PATIENT-001 | To verify | BLK-LEG-01 | ☐ |
| 5 Images Uploaded | SMOKETEST-IMG-001 | To verify | — | ☐ |
| 6 Treatment Plan Created | SMOKETEST-PLAN-001 | To verify | BLK-X-04 | ☐ |
| 7 Deposit Recorded | SMOKETEST-DEPOSIT-001 | To verify | BLK-FIN-01 | ☐ |
| 8 Surgery Booked | SMOKETEST-BOOK-SURG-001 | To verify | BLK-FIN-02 | ☐ |
| 9 Procedure Day Executed | SMOKETEST-PROC-001 | To verify | BLK-ACA-01 | ☐ |
| 10 Post-op Review Completed | SMOKETEST-POSTOP-001 | To verify | BLK-MED-01, BLK-REC-01 | ☐ |
| 11 HairAudit / Outcome Linked | SMOKETEST-HAIRAUDIT-001 | To verify | BLK-LEG-01 | ☐ |
| 12 Analytics Updated | SMOKETEST-ANALYTICS-001 | To verify | BLK-INT-01, BLK-X-05 | ☐ |

---

## Sign-off

| Role | Name | Date | Journey accepted |
|------|------|------|:----------------:|
| Operator | To verify | To verify | ☐ |
| Evolved clinic lead | To verify | To verify | ☐ |
| FI platform lead | To verify | To verify | ☐ |

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| To verify | FI-PH1 Task 3 — smoketest journey template created | — |
