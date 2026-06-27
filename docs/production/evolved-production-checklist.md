# Evolved Hair Restoration — FI-PH1 Production Checklist

**Tenant:** Evolved Hair Restoration (Perth)  
**Env var:** `EVOLVED_PERTH_TENANT_ID` → `fi_tenants.id` (confirm in production — **To verify**)  
**Sprint:** [FI-PH1 production hardening](./fi-ph1-production-hardening-sprint.md)  
**Scorecard:** [Readiness scorecard](./readiness-scorecard.md) (target **95/100**)

**Instructions**

- Prefix test records with `SMOKETEST-` per [clinic readiness runbook](../smoke/fi-os-clinic-readiness-runbook.md).
- Do not invent pass/fail — mark **To verify** until evidence is captured.
- Attach evidence: smoke log, screenshot, read-only SQL output, or ticket URL in **Failure notes**.

**Related platform docs:** [Platform registry](../platform-architecture/README.md) · [Production readiness](../runbooks/fi-os-production-readiness.md) · [ReceptionOS pilot](../runbooks/reception-os-production-readiness.md)

---

## How to use each workflow section

Every workflow below includes:

1. **Validation checklist** — operator steps in FI Admin  
2. **Expected database / system signals** — tables, events, env vars (from registry; not asserted live)  
3. **Pass criteria** — minimum for FI-PH1  
4. **Failure notes** — free text during sprint  

**Status key:** ☐ To verify · ☑ Pass · ☒ Fail · ⚠ Accepted risk

---

## LeadFlow

**Registry:** [leadflow.md](../platform-architecture/leadflow.md)  
**Routes (typical):** `/fi-admin/[tenantId]/crm`, leads pipeline, import centre

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| L1 | Authenticated CRM operator can open CRM shell for Evolved tenant | To verify |
| L2 | Create `SMOKETEST-` lead with source and stage | To verify |
| L3 | Move lead through pipeline stage; stage history visible | To verify |
| L4 | Convert lead → person/patient path (or documented equivalent) | To verify |
| L5 | CRM activity feed shows lead events | To verify |
| L6 | Quote creation from lead context (if used by Evolved) | To verify |
| L7 | HubSpot / external ingest — confirm N/A or tested path | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Lead rows | `fi_crm_leads`, optionally `fi_leads` | Parallel models during migration — **To verify** which Evolved uses |
| Stage history | `fi_crm_lead_stage_history`, `fi_crm_pipeline_stages` | Append-only stage changes |
| Activity | `fi_crm_activity_events` (`activity_kind` e.g. `lead.created`, `lead.converted_to_person`) | See [workflow events audit](../audits/fi-workflow-events-audit.md) |
| External ingest | `fi_external_events` | HubSpot queue — **To verify** if enabled for Evolved |
| Reminders | Reminder cron + `FI_REMINDER_CRON_SECRET` | Lead-created triggers — [production readiness](../runbooks/fi-os-production-readiness.md) |

### Pass criteria

- Evolved staff can create, stage, and convert a test lead without cross-tenant leakage.
- Activity events appear for create/update/conversion.
- External ingest either passes validation or is explicitly **N/A** with product sign-off.

### Failure notes

_To be filled during FI-PH1 validation._

---

## CalendarOS

**Registry:** [calendar-os.md](../platform-architecture/calendar-os.md)  
**Routes:** `/fi-admin/[tenantId]/calendar`, `/bookings`, quick-book flows

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| C1 | Calendar loads with **Australia/Perth** "today" semantics | To verify |
| C2 | Create `SMOKETEST-` booking linked to patient/consultation | To verify |
| C3 | Room / staff eligibility respected (if configured) | To verify |
| C4 | Booking appears in operational calendar and bookings list | To verify |
| C5 | Google Calendar sync — connected or documented N/A | To verify |
| C6 | Timely webhook path — configured or N/A | To verify |
| C7 | Sync health / review queue reviewed (no silent conflicts) | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Bookings | `fi_bookings` | Shared with ClinicOS |
| Rooms | `fi_clinic_rooms`, `fi_service_room_eligibility` | Perth seed migration referenced in [production readiness §2](../runbooks/fi-os-production-readiness.md) |
| Google sync | `fi_calendar_integrations`, `fi_calendar_events`, `fi_calendar_sync_health` | OAuth encrypted tokens |
| Platform events | `fi_platform_events` | GC-10 calendar bus events — **To verify** emission |
| Timely | `FI_TIMELY_WEBHOOK_SECRET`, integration routes | [webhook audit](../runbooks/fi-os-webhook-production-audit.md) |
| Timezone | Tenant `default_timezone` | Perth for Evolved — **To verify** |

### Pass criteria

- FI-native booking create/edit/cancel works for Evolved.
- Timezone and agenda buckets match clinic expectations.
- External sync failure degrades to FI bookings (no sole dependency on Google).

### Failure notes

_To be filled during FI-PH1 validation._

---

## ConsultationOS

**Design:** [19-consultation-os-architecture.md](../design/19-consultation-os-architecture.md)  
**Routes:** `/fi-admin/[tenantId]/consultations`, consultation forms

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| CO1 | Open consultations list for Evolved tenant | To verify |
| CO2 | Create consultation linked to booking/patient (`fi_consultations.booking_id` path) | To verify |
| CO3 | Complete at least one form used by Evolved (e.g. hair-loss treatment, follow-up, pathology) | To verify |
| CO4 | Consultant staff assignment persists | To verify |
| CO5 | Consultation visible on patient timeline / CRM activity | To verify |
| CO6 | Path to quote / case conversion understood and tested | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Consult records | `fi_consultations` | Booking + consultant FKs — migrations in [production readiness](../runbooks/fi-os-production-readiness.md) |
| Forms | Consultation form routes under `/consultations/[id]/forms/` | **To verify** which forms Evolved uses in production |
| Activity | `fi_crm_activity_events` | Consultation-related kinds — **To verify** |
| Visual assessment | [consultation-os-visual-assessment-v1.md](../architecture/consultation-os-visual-assessment-v1.md) | **To verify** if enabled |

### Pass criteria

- End-to-end: booking → consultation record → form save → retrievable on patient context.
- No data loss on refresh; tenant scoping enforced.

### Failure notes

_To be filled during FI-PH1 validation._

---

## PatientOS

**Registry:** [patient-os.md](../platform-architecture/patient-os.md)  
**Routes:** `/fi-admin/[tenantId]/patients`, patient profile, timeline, images

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| P1 | Patient search returns Evolved patients only | To verify |
| P2 | Open profile: demographics + clinical details | To verify |
| P3 | Treatment timeline aggregates bookings, activity, images | To verify |
| P4 | Upload clinical image to `SMOKETEST-` patient | To verify |
| P5 | Pathology request / AI interpretation (if used) | To verify |
| P6 | Case linkage from patient record | To verify |
| P7 | Global search (`/api/tenants/.../clinic-os/global-search`) session-gated in production | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Identity | `fi_persons`, `fi_patients`, `fi_patient_clinical_details` | RLS tenant-scoped |
| Timeline | `fi_timeline_events`, CRM activity | [patient timeline audit](../audits/patient-timeline-unification.md) |
| Images | `fi_patient_images` | ImagingOS consumer — [imaging-os-architecture.md](../imaging-os-architecture.md) |
| Cases | `fi_cases`, `fi_case_procedures` | SurgeryOS linkage |
| Pathology | `fi_pathology_requests`, `fi_pathology_ai_interpretations` | **To verify** usage |
| System status | `/fi-admin/[tenantId]/system-status` | Feature readiness bands — [20-system-status](../design/20-system-status-and-readiness.md) |

### Pass criteria

- Patient CRUD and image upload work under real staff session.
- Cross-tenant search denial verified (optional second tenant in smoke).

### Failure notes

_To be filled during FI-PH1 validation._

---

## ImagingOS

**Architecture:** [imaging-os-architecture.md](../imaging-os-architecture.md)  
**Surfaces:** Patient images, appointment procedure photos, guided capture (`src/lib/imagingOs/`)

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| I1 | Staff upload via patient images UI | To verify |
| I2 | Image categories / protocol labels match Evolved workflow | To verify |
| I3 | Procedure photos panel on appointment detail (pre_op / post_op) | To verify |
| I4 | Storage bucket policies — no public list | To verify |
| I5 | ImagingOS stub pipeline — confirm expectations (no false AI claims) | To verify |
| I6 | HairAudit classify path — N/A or internal-only | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Patient images | `fi_patient_images` | Primary clinic upload path |
| Imaging contracts | `src/lib/imaging-os/*` | IM-1 stub mode documented |
| Storage | Supabase Storage (`fi-intakes` and related) | [storage backup drill](../runbooks/fi-os-storage-backup-restore-drill.md) |
| HLI classify | `hli_image_classifications` | Separate from IM-1 stub — **To verify** |

### Pass criteria

- Images upload, display, and archive without broken signed URLs.
- Operators understand IM-1 is contract/stub — not production AI vision unless separately activated.

### Failure notes

_To be filled during FI-PH1 validation._

---

## SurgeryOS

**Registry:** [surgery-os.md](../platform-architecture/surgery-os.md)  
**Routes:** `/fi-admin/[tenantId]/cases`, procedure day surfaces

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| S1 | Cases list loads for Evolved tenant | To verify |
| S2 | Open case: surgery plan + procedures | To verify |
| S3 | Procedure day V1.1 — team + milestones fields persist | To verify |
| S4 | Graft session / count events (if used on procedure day) | To verify |
| S5 | Post-op tracking entry | To verify |
| S6 | Financial clearance gate before surgery day — understood | To verify |
| S7 | Migration `20260718120002_fi_case_procedures_v11_team_milestones.sql` applied | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Cases | `fi_cases`, `fi_case_surgery_plans`, `fi_case_procedures` | Soft-delete guards |
| Graft | `fi_surgery_graft_sessions`, `fi_surgery_graft_count_events` | Append-only counts |
| Safety | `fi_surgery_os_graft_clinical_safety` | **To verify** rules configured |
| Post-op | `fi_case_post_op_tracking` | |
| Booking link | `fi_bookings` surgery service types | CalendarOS |

### Pass criteria

- Case → procedure day workflow completable for `SMOKETEST-` case (or dry-run on real case with staff approval).
- V1.1 columns present — procedure day does not 500 on team/milestone saves.

### Failure notes

_To be filled during FI-PH1 validation._

---

## FinancialOS

**Registry:** [financial-os.md](../platform-architecture/financial-os.md)  
**Scope note:** Manual `fi_payment_records` is **operational visibility**, not live card processing — [production readiness](../runbooks/fi-os-production-readiness.md)

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| F1 | Financial dashboard / payment records list loads | To verify |
| F2 | Create manual payment record for `SMOKETEST-` patient/case | To verify |
| F3 | Deposit status visible to reception / surgery gating | To verify |
| F4 | Quotes linked to CRM lead/patient path | To verify |
| F5 | Invoices / Stripe automation — confirm **not required** for FI-PH1 or test if enabled | To verify |
| F6 | Finance applications / super-release — N/A or pilot scope documented | To verify |
| F7 | Tax localisation settings for AU | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Payments | `fi_payment_records` | Manual tracking |
| Transactions | `fi_financial_transactions`, `fi_financial_transaction_audit_events` | **To verify** usage depth |
| Quotes | `fi_crm_quotes`, `fi_quotes` overlap | LeadFlow linkage |
| Revenue | `fi_revenue_pipeline` | Analytics — **To verify** |
| Webhooks | Stripe idempotency — [payment-webhook-idempotency.md](../security/payment-webhook-idempotency.md) | **To verify** if Stripe connected |
| Tax | `fi_tax_localisation_settings` | Migration in production readiness chain |

### Pass criteria

- Staff can record and update deposit/payment **expectations** without corrupting amounts or tenant scope.
- No workflow implies automated bank settlement when only manual records exist.

### Failure notes

_To be filled during FI-PH1 validation._

---

## ReceptionOS

**Runbook:** [reception-os-production-readiness.md](../runbooks/reception-os-production-readiness.md)  
**Routes:** `/fi-admin/[tenantId]/reception` (legacy), `/reception-os` (command centre)

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| R1 | Legacy reception kanban still loads (no regression) | To verify |
| R2 | ReceptionOS command centre loads; pilot banner visible | To verify |
| R3 | `RECEPTION_OS_COMMUNICATION_DRY_RUN=true` for initial production | To verify |
| R4 | Task inbox create/complete | To verify |
| R5 | System status panel shows dry-run + provider flags | To verify |
| R6 | `npm run validate:reception-os` with Evolved tenant UUID | To verify |
| R7 | Migrations `20260919120001`–`20260919120004` applied | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Tasks | Reception task tables (phase 2+) | See reception runbook §1 |
| Communications | Template + audit tables | Phase 4 |
| Metrics | Phase 7 pilot metrics | `ReceptionOsPilotManagerWidget` references Evolved pilot |
| Env | `RECEPTION_OS_*`, `RESEND_*`, `TWILIO_*` | Dry-run default |

### Pass criteria

- Front desk can run daily board + ReceptionOS inbox without accidental live SMS/email during pilot.
- Legacy `/reception` remains usable.

### Failure notes

_To be filled during FI-PH1 validation._

---

## Security

**References:** [fi-os-access-production.md](../fi-os-access-production.md) · [auth audit](../runbooks/fi-os-auth-production-audit.md) · [env audit](../runbooks/fi-os-env-vars-production-audit.md) · [infrastructure hardening](../security/infrastructure-hardening-audit.md)

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| SEC1 | `NODE_ENV=production` on public host; dev bypass flags off | To verify |
| SEC2 | Unauthenticated tenant API returns 401/403 (global search, audit APIs) | To verify |
| SEC3 | `?adminKey=` blocked in production; header/Bearer only | To verify |
| SEC4 | Legacy `/api/fi/*` disabled or secret-gated (`FI_LEGACY_FI_API_ENABLED`) | To verify |
| SEC5 | Cron endpoints reject wrong/missing secrets (401/503) | To verify |
| SEC6 | Timely webhook secret ≥ 16 chars when route used | To verify |
| SEC7 | Staff PIN routes — rate limit / audit (**To verify** policy) | To verify |
| SEC8 | RLS spot-check on patient + CRM tables | To verify |
| SEC9 | No secrets in `NEXT_PUBLIC_*` | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Identities | `fi_users`, `fi_os_identities` | Portal membership |
| PIN audit | `fi_staff_pin_audit` | Reception board |
| Admin audit | `fi_tenant_admin_audit_*` | Platform admin actions |
| Env validation | `pnpm run check:env` | [`fiEnv.server.ts`](../../src/lib/env/fiEnv.server.ts) |

### Pass criteria

- [`pnpm run smoke:prod`](../../scripts/fi-production-smoke-test.ts) passes auth-negative probes.
- Production access matches [fi-os-access-production.md](../fi-os-access-production.md) checks 5–7.
- Open **Must fix** items from [master checklist](../runbooks/fi-os-production-hardening-master-checklist.md) triaged.

### Failure notes

_To be filled during FI-PH1 validation._

---

## Monitoring

**References:** [clinic readiness smoke](../smoke/fi-os-clinic-readiness-runbook.md) · [system status](../design/20-system-status-and-readiness.md) · [HR sync health](../runbooks/iiohr-hr-staff-sync.md)

### Validation checklist

| # | Check | Status |
|---|-------|--------|
| M1 | `pnpm run smoke:prod` scheduled post-deploy | To verify |
| M2 | System status page loads for Evolved tenant | To verify |
| M3 | `GET /api/health/iiohr-hr-staff-sync` — stale/fresh semantics understood | To verify |
| M4 | Vercel cron jobs configured (reminders, HR sync) | To verify |
| M5 | Log review process for 401/403 spikes on cron/webhooks | To verify |
| M6 | Backup / PITR status documented | To verify |
| M7 | Rollback playbook acknowledged — [fi-os-rollback-playbook.md](../runbooks/fi-os-rollback-playbook.md) | To verify |

### Expected database / system signals

| Signal | Table / channel | Notes |
|--------|-----------------|-------|
| Staff sync runs | `fi_staff_sync_runs` | IIOHR cron |
| Calendar health | `fi_calendar_sync_health`, `fi_calendar_sync_runs` | **To verify** if Google connected |
| Platform events | Delivery failures in `fi_platform_event_deliveries` | **To verify** |
| In-app readiness | System status score | Not equivalent to [scorecard](./readiness-scorecard.md) |

### Pass criteria

- Automated smoke + at least one manual monitoring runbook owner assigned.
- On-call or business-hours escalation path documented for P0/P1 (see sprint doc).

### Failure notes

_To be filled during FI-PH1 validation._

---

## Master pass/fail matrix

| Workflow | Pass | Fail | Accepted risk | Owner | Date |
|----------|:----:|:----:|:-------------:|-------|------|
| LeadFlow | ☐ | ☐ | ☐ | To verify | |
| CalendarOS | ☐ | ☐ | ☐ | To verify | |
| ConsultationOS | ☐ | ☐ | ☐ | To verify | |
| PatientOS | ☐ | ☐ | ☐ | To verify | |
| ImagingOS | ☐ | ☐ | ☐ | To verify | |
| SurgeryOS | ☐ | ☐ | ☐ | To verify | |
| FinancialOS | ☐ | ☐ | ☐ | To verify | |
| ReceptionOS | ☐ | ☐ | ☐ | To verify | |
| Security | ☐ | ☐ | ☐ | To verify | |
| Monitoring | ☐ | ☐ | ☐ | To verify | |

**Next step:** Roll scores into [readiness-scorecard.md](./readiness-scorecard.md) and confirm FI-PH1 [completion criteria](./fi-ph1-production-hardening-sprint.md#completion-criteria).
