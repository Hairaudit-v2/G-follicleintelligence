# Evolved Hair Restoration — Operational Validation Framework

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Tenant env var:** `EVOLVED_PERTH_TENANT_ID` → `fi_tenants.id` (confirm in Vercel — **To verify**)  
**Architecture freeze:** Active — validation only; no new modules or routes.

**Related docs**

- [Evolved production checklist](./evolved-production-checklist.md) — checklist pass/fail matrix
- [Evolved workflow matrix](./evolved-workflow-matrix.md) — end-to-end patient journey
- [Evolved production blockers](./evolved-production-blockers.md) — known gaps
- [Clinic readiness smoke runbook](../smoke/fi-os-clinic-readiness-runbook.md) — `SMOKETEST-` prefix convention
- [Platform architecture registry](../platform-architecture/README.md)

---

## How to use this document

Each **OS category** below defines a production validation slice for Evolved Perth. Run steps in order using authenticated FI Admin staff sessions unless noted. Prefix all test records with `SMOKETEST-`. Capture evidence (screenshot, smoke log, read-only SQL) before marking pass.

**Evidence fields:** Date · Operator · Environment URL · Pass / Fail / To verify

---

## LeadFlow

### Workflow objective

Capture and progress commercial enquiries from intake through pipeline stages to person/case conversion and consultation booking readiness.

### Production test steps

1. Authenticate as CRM-capable staff; open `/fi-admin/[tenantId]/crm`.
2. Create `SMOKETEST-` lead with source, stage, and contact fields.
3. Move lead across at least two pipeline stages; confirm stage history visible.
4. Add note and task on the lead; confirm in activity feed.
5. Execute lead → person/patient conversion (or documented Evolved equivalent).
6. Optionally create CRM quote from lead context if Evolved uses quotes pre-consult.
7. Confirm HubSpot import / external ingest is **N/A** or run dry-run only per [HubSpot import safety](../runbooks/hubspot-import-safety-and-rollback.md).

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Lead row | `fi_crm_leads` (and/or parallel `fi_leads` — **To verify** which Evolved uses) |
| Stage change | `fi_crm_lead_stage_history`, `fi_crm_pipeline_stages` reference |
| Activity | `fi_crm_activity_events` (`lead.created`, `lead.updated`, `lead.converted_to_person`, etc.) |
| Notes / tasks | `fi_crm_notes`, `fi_crm_tasks` |
| Conversion | `fi_persons`, `fi_patients` (via conversion path) |
| External queue (if enabled) | `fi_external_events` |

### Success criteria

- Lead CRUD and stage transitions complete without cross-tenant leakage.
- Activity events append for create, update, and conversion.
- Converted person/patient retrievable from CRM and patient directory.
- External ingest either validated or explicitly **N/A** with product sign-off.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Lead visible in wrong tenant | **P0** — stop validation; security incident |
| Conversion creates duplicate person | Document IDs; use merge/source-id tooling if available; do not delete production rows without runbook |
| HubSpot commit without dry-run pass | Do not commit; follow [HubSpot rollback](../runbooks/hubspot-import-safety-and-rollback.md) |
| Stage history missing | Fail category; log ticket — pipeline audit integrity broken |
| Reminder cron misfire on `lead.created` | Verify `FI_REMINDER_CRON_SECRET`; check `fi_reminder_jobs` — non-blocking for lead CRUD pass |

---

## CalendarOS

### Workflow objective

Schedule and manage FI-native bookings with Perth timezone semantics; optional Google Calendar mirror and Timely webhook ingest must not be sole source of truth.

### Production test steps

1. Confirm tenant `default_timezone` is **Australia/Perth** (**To verify** in `fi_tenants` / tenant settings).
2. Open `/fi-admin/[tenantId]/calendar` and `/bookings`; confirm “today” buckets match Perth local date.
3. Create `SMOKETEST-` booking linked to patient/consultation with appropriate service type.
4. Assign room and staff if Evolved has Perth room seed (`fi_clinic_rooms`, `fi_service_room_eligibility`).
5. Edit and cancel a test booking; confirm list and calendar views update.
6. If Google Calendar connected: review sync health (`fi_calendar_sync_health`), staged import queue (`fi_external_calendar_event_staging`), and GC-7 review items — **do not assume approve creates FI bookings** (staging-only approve today).
7. If Timely configured: verify webhook secret ≥ 16 chars; wrong-secret probe returns non-200 per `pnpm run smoke:prod`.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Booking | `fi_bookings` |
| Resource requirements | `fi_booking_resource_requirements` (if configured) |
| CRM side-effect | `fi_crm_activity_events` (`booking.created`, etc.) |
| Google mirror | `fi_calendar_events`, `fi_calendar_sync_runs` |
| Staged import | `fi_external_calendar_event_staging`, `fi_external_calendar_event_mappings` |
| Platform bus (best-effort) | `fi_platform_events` (GC-10 calendar events) |

### Success criteria

- FI-native booking create/edit/cancel works under real staff session.
- Timezone and agenda semantics match clinic expectations.
- External sync failure degrades gracefully — FI bookings remain authoritative.
- No silent duplicate bookings from staged Google approve path.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Booking 500 on room/staff columns | Verify migrations through `fi_bookings_room_columns` chain |
| OAuth token expired | Reconnect integration; bookings still editable in FI |
| Staged events approved but no FI booking | **Expected today** — document manual booking creation workflow |
| Sync conflict unreviewed | Triage GC-7 queue before production calendar reliance |
| Cross-tenant booking in search | **P0** — stop; auth/RLS incident |

---

## ConsultationOS

### Workflow objective

Record consultation episodes linked to bookings and patients; complete clinical forms; enable handoff to surgery planning and quotes.

### Production test steps

1. Open `/fi-admin/[tenantId]/consultations`.
2. Create consultation with `fi_consultations.booking_id` and consultant staff assignment.
3. Complete at least one Evolved production form (e.g. hair-loss treatment, follow-up, pathology — **To verify** which forms are live).
4. Save, refresh, reload — confirm no data loss.
5. Verify consultation appears on patient timeline / CRM activity.
6. If automation enabled: complete form and confirm handoff state (case seed, surgery plan draft, follow-up task) per tenant policy — use `dryRun` preview in non-prod first.
7. Test consultation search-links API is session-gated in production.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Consultation | `fi_consultations` |
| Form instances | Consultation form tables (form-specific persistence under `src/lib/consultationForms/`) |
| Handoff side-effects | `fi_cases`, `fi_case_surgery_plans` (draft), `fi_crm_tasks` (when automation runs) |
| Activity | `fi_crm_activity_events` (consultation-related kinds — **To verify**) |
| Timeline | `fi_timeline_events` (when foundation/timeline writers fire) |

### Success criteria

- Booking → consultation → form save → retrievable on patient context.
- Tenant scoping enforced on all reads/writes.
- Form completion does not 500 on consultant or booking FKs.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Form save 500 | Capture form instance ID; check migration parity for consultation extensions |
| Automation creates duplicate case | Use handoff idempotency state (`loadConsultationHandoffState`); manual case merge per ops policy |
| Orphan consultation (no patient) | Fail — conversion path must be exercised first |
| Partial form data after refresh | **P1** — data integrity defect |

---

## PatientOS

### Workflow objective

Maintain unified patient identity, clinical details, timeline, pathology, and case linkage for Evolved clinical operations.

### Production test steps

1. Open `/fi-admin/[tenantId]/patients`; search returns Evolved patients only.
2. Open `SMOKETEST-` patient profile — demographics, clinical details, scales.
3. Verify treatment timeline aggregates bookings, CRM activity, and images.
4. Create or update clinical details; confirm persistence.
5. Create pathology request if Evolved uses pathology workflow; cancel test request if needed.
6. Link patient to case from patient record.
7. Run global search `/api/tenants/.../clinic-os/global-search` — unauthenticated request must 401/403 in production.
8. Review `/fi-admin/[tenantId]/system-status` for PatientOS readiness band.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Patient identity | `fi_persons`, `fi_patients`, `fi_patient_clinical_details` |
| Timeline | `fi_timeline_events`, `fi_crm_activity_events` |
| Pathology | `fi_pathology_requests`, `fi_pathology_results`, `fi_pathology_ai_interpretations` |
| Cases | `fi_cases` (linkage) |
| Source IDs | `fi_patient_source_ids`, `fi_person_source_ids` |

### Success criteria

- Patient CRUD under real staff session.
- Cross-tenant search denial verified (optional second-tenant smoke).
- Timeline shows expected events for test patient journey.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Patient in wrong tenant search | **P0** |
| Duplicate person on conversion | Document source IDs; merge tooling |
| Timeline gap after known ingest | Replay from `fi_events` if applicable |
| Pathology PDF generation 500 | Verify service-role path; fail pathology slice only |

---

## ImagingOS

### Workflow objective

Upload, store, and display clinical photography; understand IM-1 stub pipeline expectations (no false AI claims in production ops).

### Production test steps

1. Upload clinical image to `SMOKETEST-` patient via patient images UI.
2. Confirm image displays with signed URL; archive test image if policy allows.
3. Verify storage bucket policies — no public list (`fi-intakes` and related buckets).
4. Open appointment procedure photos panel (pre_op / post_op) if used on procedure day.
5. Confirm ImagingOS stub pipeline expectations documented to staff (quality/protocol/classification stubs — see [imaging-os-architecture.md](../imaging-os-architecture.md)).
6. HairAudit classify path: confirm **N/A** for Evolved ops or internal-only endpoint with bearer auth.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Patient images | `fi_patient_images` |
| Storage object | Supabase Storage (patient image buckets) |
| HLI classifications (if used) | `hli_image_classifications` |
| Analytics (optional) | `fi_analytics_events` (`module_name: imaging_os`) when publishers fire |

### Success criteria

- Images upload, display, and archive without broken signed URLs.
- Operators understand IM-1 is contract/stub unless IM-12 live AI explicitly activated.
- No production UI implies automated AI vision when stub mode active.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Upload 403/500 | Check storage policies and RLS |
| Signed URL expiry breaks chart | Storage backup/restore drill status must be documented |
| Public bucket list | **P0** — storage policy incident |
| False AI classification shown as definitive | Fail — misrepresentation risk |

---

## SurgeryOS

### Workflow objective

Manage cases, surgery plans, procedure day workflow (V1.1 team + milestones), graft sessions, and post-op tracking.

### Production test steps

1. Open `/fi-admin/[tenantId]/cases`; list loads for Evolved tenant.
2. Open `SMOKETEST-` case — surgery plan, procedures, financial clearance indicators (**To verify** gating rules).
3. Save procedure day V1.1 fields: `nurse_user_id`, `technician_user_ids`, `procedure_milestones`.
4. Record graft session / count events if Evolved uses live count on procedure day.
5. Enter post-op tracking row.
6. Confirm migration `20260718120002_fi_case_procedures_v11_team_milestones.sql` applied.
7. Soft-delete test case; confirm disappearance from boards per `activeCaseFilter`.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Case | `fi_cases`, `fi_case_surgery_plans`, `fi_case_procedures` |
| Graft | `fi_surgery_graft_sessions`, `fi_surgery_graft_count_events` |
| Safety | `fi_surgery_os_graft_clinical_safety` (if rules configured) |
| Post-op | `fi_case_post_op_tracking` |
| Booking link | `fi_bookings` (surgery service types) |

### Success criteria

- Case → procedure day workflow completable for test case (or staff-approved dry-run on real case).
- V1.1 columns present — team/milestone saves do not 500.
- Financial clearance state understood before real procedure day.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Missing V1.1 columns | Apply migration chain; block procedure day go-live |
| Graft count reconciliation mismatch | Document session ID; staff review UI |
| Procedure without clearance | **Expected gate** — document override audit path |
| Case visible after soft-delete | Fail activeCaseFilter regression |

---

## FinancialOS

### Workflow objective

Record deposit and payment **expectations** (manual tracking); link quotes to CRM/case path; provide operational visibility — **not** automated card settlement unless Stripe explicitly enabled and validated.

### Production test steps

1. Open financial dashboard and payment records list.
2. Create manual `fi_payment_records` row for `SMOKETEST-` patient/case.
3. Update deposit status; confirm visible to reception/surgery gating surfaces.
4. Create or link CRM quote (`fi_crm_quotes`) from lead/patient path.
5. Confirm Stripe/webhook path: **N/A** for FI-PH1 or test in staging with idempotency checks.
6. Verify AU tax localisation settings (`fi_tax_localisation_settings`).
7. Review payment pathway inbox — confirm escalation cron supports `dryRun` for rehearsal.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Manual payments | `fi_payment_records` |
| Transactions (if used) | `fi_financial_transactions`, `fi_financial_transaction_audit_events` |
| Quotes | `fi_crm_quotes`, potential `fi_invoices` overlap |
| Revenue pipeline | `fi_revenue_pipeline` |
| Stripe webhook (if enabled) | `fi_payment_webhook_events` |

### Success criteria

- Staff can record and update deposit/payment expectations without amount corruption or tenant scope breach.
- No workflow implies bank settlement when only manual records exist.
- Quotes link correctly to case/patient in Payments Inbox.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Wrong tenant on payment record | **P0** |
| Stripe duplicate credit | Follow [payment-webhook-idempotency](../security/payment-webhook-idempotency.md); manual reconciliation |
| Staff assumes live card capture | Training failure — document manual-only scope |
| Pathway inbox false escalation | Run clearance cron with `dryRun=1` first |

---

## ReceptionOS

### Workflow objective

Front-desk daily operations: legacy reception board plus ReceptionOS command centre with **dry-run communication** during initial production pilot.

### Production test steps

1. Confirm `RECEPTION_OS_COMMUNICATION_DRY_RUN=true` in production Vercel env.
2. Confirm `RECEPTION_OS_EMAIL_SEND_ENABLED` and `RECEPTION_OS_SMS_SEND_ENABLED` are unset/false.
3. Load legacy `/fi-admin/[tenantId]/reception` — kanban must not regress.
4. Load `/fi-admin/[tenantId]/reception-os` — pilot banner and system status panel visible.
5. Create and complete task in ReceptionOS inbox.
6. Trigger test communication — verify audit row created, **no external Resend/Twilio delivery**.
7. Run `RECEPTION_OS_PILOT_TENANT_ID=<uuid> npm run validate:reception-os`.
8. Confirm migrations `20260919120001`–`20260919120004` applied.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Tasks | Reception task tables (phase 2+) |
| Communications | Template + audit tables (phase 4) |
| Delivery / closeout | Phase 5–7 tables |
| Metrics | Phase 7 pilot usage events |

### Success criteria

- Front desk can run daily board + ReceptionOS inbox without accidental live SMS/email.
- System status panel shows dry-run ON.
- Legacy reception remains usable.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Live SMS/email sent during pilot | **P1** — set dry-run; audit `communication_sent` rows |
| ReceptionOS 500 on missing migration | Apply reception migration chain |
| Task audit missing | Fail reception slice |
| Dry-run flag off unintentionally | Immediate env rollback via Vercel |

---

## WorkforceOS

### Workflow objective

Staff directory, HR sync from IIOHR Perth feed, PIN/kiosk access, rostering signals for calendar and surgery team assignment.

### Production test steps

1. Open staff directory for Evolved tenant; confirm IIOHR-sourced staff rows.
2. Verify `GET /api/health/iiohr-hr-staff-sync` — stale/fresh semantics documented.
3. Trigger or review latest `fi_staff_sync_runs` row for Evolved.
4. Confirm `EVOLVED_PERTH_TENANT_ID` matches cron env for `/api/cron/iiohr-hr-perth-staff-sync`.
5. Test staff PIN login/logout on reception board if used — verify audit in `fi_staff_pin_audit`.
6. Link test staff to `fi_users` if schedulability required.
7. Review `fi_service_staff_eligibility` for booking constraints.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Staff upsert | `fi_staff`, `fi_staff_source_ids` |
| Sync run | `fi_staff_sync_runs` |
| PIN audit | `fi_staff_pin_audit` |
| Feature access | `fi_staff_feature_access`, audit events |
| Shifts / availability (if used) | `fi_staff_shifts`, `fi_staff_availability_blocks` |

### Success criteria

- HR sync completes or fails with logged status — not silent.
- Staff visible in calendar columns and consultation assignment dropdowns.
- PIN flow auditable.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| HR sync partial — stale directory | Rerun cron; manual sync POST with secret |
| Staff double-booked | Calendar conflict detection — document override |
| Unlinked fi_user | Admin linking UI required before schedulability |
| PIN brute-force (no rate limit) | **Accepted risk** for FI-PH1 — document in blockers |

---

## AnalyticsOS

### Workflow objective

Normalized operational analytics from module events; executive snapshots for clinic performance — understanding partial ingest today.

### Production test steps

1. Complete a minimal patient journey (lead → booking → consult) with `SMOKETEST-` prefix.
2. Query read-only: `fi_analytics_events` for Evolved `tenant_id` with recent `occurred_at`.
3. Open analytics / executive surfaces in FI Admin (**To verify** which dashboards Evolved uses).
4. Confirm `module_name` values match DB check constraint (`leadflow`, `consultation_os`, `surgery_os`, etc.).
5. Compare in-app system status readiness score vs [readiness scorecard](./readiness-scorecard.md) — they measure different things.
6. Confirm intelligence bus / replay dashboards are **not** treated as production analytics SoR.

### Expected database writes

| Write | Table / channel |
|-------|-----------------|
| Module events | `fi_analytics_events` (append-only, service role ingest) |
| Executive snapshots | `fi_financial_executive_snapshots` (cross-module) |
| CRM activity (parallel) | `fi_crm_activity_events` — not a substitute for analytics normalization |
| Platform bus | `fi_platform_events` → optional analytics fan-out (Phase 2) |

### Success criteria

- At least one module event recorded for test journey (**To verify** which modules publish today).
- Dashboard loads without 500 for Evolved tenant.
- Operators understand analytics may be incomplete until all modules emit normalized events.

### Rollback / failure criteria

| Failure | Rollback / response |
|---------|---------------------|
| Empty analytics after full journey | Fail partial — document which module lacks publisher |
| Invalid `module_name` insert rejected | Expected DB guard — fix publisher |
| Duplicate events inflating metrics | Idempotency at publish layer not fully deployed — document |
| Executive snapshot stale | Scheduled regeneration — non-blocking if raw events present |

---

## Cross-category validation order (recommended)

| Order | Category | Rationale |
|------:|----------|-----------|
| 1 | WorkforceOS | Staff and HR sync underpin scheduling |
| 2 | LeadFlow | Funnel entry |
| 3 | CalendarOS | Consultation booking |
| 4 | ConsultationOS | Clinical-commercial bridge |
| 5 | PatientOS | Identity and timeline |
| 6 | ImagingOS | Evidence capture |
| 7 | FinancialOS | Deposit recording |
| 8 | SurgeryOS | Procedure path |
| 9 | ReceptionOS | Front-desk pilot |
| 10 | AnalyticsOS | Journey closure signals |

---

## Master validation sign-off

| Category | Validated | Owner | Date | Evidence link |
|----------|:---------:|-------|------|---------------|
| LeadFlow | ☐ | To verify | | |
| CalendarOS | ☐ | To verify | | |
| ConsultationOS | ☐ | To verify | | |
| PatientOS | ☐ | To verify | | |
| ImagingOS | ☐ | To verify | | |
| SurgeryOS | ☐ | To verify | | |
| FinancialOS | ☐ | To verify | | |
| ReceptionOS | ☐ | To verify | | |
| WorkforceOS | ☐ | To verify | | |
| AnalyticsOS | ☐ | To verify | | |

**Next:** Roll results into [readiness scorecard](./readiness-scorecard.md) and [evolved-production-blockers.md](./evolved-production-blockers.md).
