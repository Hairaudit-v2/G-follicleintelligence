# Evolved Hair Restoration — Smoketest Journey

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Purpose:** Single end-to-end SMOKETEST journey template — lead through analytics closure  
**Convention:** Prefix all test records with `SMOKETEST-` per [clinic readiness runbook](../smoke/fi-os-clinic-readiness-runbook.md)  
**Status:** Task 6 — **In progress** (unauthenticated smoke PASS 2026-06-30; authenticated journey pending invite acceptance)  
**Last updated:** 2026-06-30

**Related docs**

- [Workflow matrix](./evolved-workflow-matrix.md) — module/table reference
- [Operational validation framework](./evolved-operational-validation.md) — per-OS steps
- [Production blockers](./evolved-production-blockers.md)
- [Go/no-go checklist](./evolved-go-no-go-checklist.md)
- [Final P0 execution dashboard](./final-p0-execution-dashboard.md)
- [Production evidence registry](./production-evidence-registry.md)

---

## Task 6 — Full journey execution status

```
Lead Created
    ↓
Consultation Booked
    ↓
Consultation Completed
    ↓
Patient Created
    ↓
Images Uploaded
    ↓
Treatment Plan Created
    ↓
Deposit Recorded
    ↓
Surgery Booked
    ↓
Procedure Day Executed
    ↓
Post-op Review Completed
    ↓
HairAudit Linked
    ↓
Analytics Updated
```

| Field | Value |
|-------|-------|
| **Execution attempted** | Partial (unauthenticated smoke only) |
| **Blocking reason** | Clinical journey steps 1–12 not yet executed with SMOKETEST- records |
| **Prerequisite** | Auth gate passed 2026-06-30; proceed with SMOKETEST- prefixed records |
| **Overall completed** | **No** (0 / 12 steps; auth + infra smoke PASS) |
| **Evidence package** | `smoke-prod-2026-06-30.txt`, `blk-sec-05-auth-cases-2026-06-30.jpeg` |

---

## Journey metadata

| Field | Value |
|-------|-------|
| **Journey ID** | SMOKETEST-JOURNEY-001 |
| **Operator** | David (Audit @hairaudit.co) |
| **Date** | 2026-06-30 |
| **Environment URL** | https://www.follicleintelligence.ai |
| **Tenant ID** | `c2615b95-b707-4485-aa5f-be8f78ec868a` (evolved-hair / Evolved Hair Restoration) |
| **Staff session** | Authenticated — David → SurgeryOS worklist (see `blk-sec-05-auth-cases-2026-06-30.jpeg`) |
| **Overall result** | ☐ Pass · ☑ Fail · ☐ Partial (Accepted risk) |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Auth gate passed 2026-06-30 (David → SurgeryOS). Step not executed — create SMOKETEST-LEAD-001. BLK-X-03: confirm which lead model is SoR for Evolved. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — step 1 not completed. BLK-CAL-01: manual FI booking remains SoR. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-X-02: workflow engine v1 handlers are placeholders. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. Cross-tenant denial test (E-ID-02) must run with non-member auth user. BLK-LEG-01: legacy API remains OFF. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-SEC-01: storage restore not verified — image DR posture unconfirmed. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-X-04: surgery plan may not appear on patient timeline feed. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-FIN-01: SOP staff acknowledgement pending (E-FIN-01). Manual records only — not Stripe proof. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-FIN-02: guard blocks confirm when `not_ready` within 14d (E-FIN-03 staging test pending); manual SOP sign-off pending. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-ACA-01: manual privilege verification required. Confirm migration `20260718120002_fi_case_procedures_v11_team_milestones.sql` applied in production. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-REC-01: ReceptionOS live-send not validated. BLK-MED-01: MedicationOS partial. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. Document **N/A** at execution if HairAudit ingest deferred; legacy API remains OFF per BLK-LEG-01 decision. |

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
| **Pass / Fail** | Fail (not executed) |
| **Completed** | **No** |
| **Evidence captured** | **No** |
| **Failure notes** | Blocked — prior steps not completed. BLK-INT-01: Intelligence Bus off in production. BLK-X-05: partial analytics publishers — document emitted vs skipped at execution. |

---

## Journey summary

| Step | Test record ID | Completed | Evidence | Pass / Fail | Blocker refs | Failure notes |
|------|----------------|:---------:|:--------:|:-----------:|--------------|---------------|
| 1 Lead Created | SMOKETEST-LEAD-001 | No | No | Fail | BLK-SEC-05, BLK-X-03 | Not started — no prod auth session |
| 2 Consultation Booked | SMOKETEST-BOOK-CONSULT-001 | No | No | Fail | BLK-CAL-01 | Blocked on step 1 |
| 3 Consultation Completed | SMOKETEST-CONSULT-001 | No | No | Fail | BLK-X-02 | Blocked on step 1 |
| 4 Patient Created | SMOKETEST-PATIENT-001 | No | No | Fail | BLK-SEC-05 | Blocked on step 1 |
| 5 Images Uploaded | SMOKETEST-IMG-001 | No | No | Fail | BLK-SEC-01 | Blocked on step 1 |
| 6 Treatment Plan Created | SMOKETEST-PLAN-001 | No | No | Fail | BLK-X-04 | Blocked on step 1 |
| 7 Deposit Recorded | SMOKETEST-DEPOSIT-001 | No | No | Fail | BLK-FIN-01 | Blocked on step 1 |
| 8 Surgery Booked | SMOKETEST-BOOK-SURG-001 | No | No | Fail | BLK-FIN-02 | Blocked on step 1 |
| 9 Procedure Day Executed | SMOKETEST-PROC-001 | No | No | Fail | BLK-ACA-01 | Blocked on step 1 |
| 10 Post-op Review Completed | SMOKETEST-POSTOP-001 | No | No | Fail | BLK-MED-01, BLK-REC-01 | Blocked on step 1 |
| 11 HairAudit / Outcome Linked | SMOKETEST-HAIRAUDIT-001 | No | No | Fail | BLK-LEG-01 | Blocked on step 1 |
| 12 Analytics Updated | SMOKETEST-ANALYTICS-001 | No | No | Fail | BLK-INT-01, BLK-X-05 | Blocked on step 1 |

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
| 2026-06-27 | FI-PH1 Task 6 — journey execution status recorded (not executed) | FI-PH1 execution |
| To verify | FI-PH1 Task 3 — smoketest journey template created | — |
