# FI-SECURITY-RESTORE-DRILL-1 plan

Repository-side plan for a non-destructive Supabase recovery validation. Production must never be restored in place, rolled back, modified, paused, or wired to a drill app. The actual recovery target is a new isolated Supabase project restored from physical backup or PITR.

## Scope and safety

- Source project: Follicle Intelligence production Supabase `iqqvzgxoimxchhcnbzxl`.
- Protected production tenant: Evolved Perth `c2615b95-b707-4485-aa5f-be8f78ec868a`.
- Canonical pre-recovery marker: `SMOKETEST-RECOVERY-MARKER-20260714` in `public.fi_crm_leads`.
- Recovery point must be after `2026-07-14T06:21:38.292Z` and inside the active PITR window.
- All validation tooling must require `FI_DRILL_CONFIRM_NON_PRODUCTION=YES` and `FI_DRILL_EXPECTED_PROJECT_REF`.
- The restored project must not have live cron, webhooks, outbound email/SMS, payments, or external connectors enabled.
- Generated evidence belongs under `docs/security/restore-drill-evidence/`, which is ignored by git.

## Repository inventory

| Domain | Canonical table or route |
| --- | --- |
| Tenant | `public.fi_tenants` |
| Organisations / clinics | `public.fi_organisations`, `public.fi_clinics` |
| Persons | `public.fi_persons`, `public.fi_person_source_ids` |
| Patients | `public.fi_patients`, `public.fi_patient_source_ids`, `public.fi_global_patients` |
| CRM leads | `public.fi_crm_leads`, `public.fi_crm_lead_source_ids`, `public.fi_crm_lead_notes`, `public.fi_crm_lead_communications`, `public.fi_crm_lead_tasks` |
| Bookings | `public.fi_bookings`, `public.fi_booking_resource_requirements` |
| Consultations | `public.fi_consultations`, `public.fi_consultation_forms`, `public.fi_consultation_form_instances`, `public.fi_consultation_form_completions` |
| Cases | `public.fi_cases`, `public.fi_case_procedures`, `public.fi_case_surgery_plans`, `public.fi_case_post_op_events` |
| Payments / money | `public.fi_payment_records`, `public.fi_payment_requests`, `public.fi_payment_webhook_events`, `public.fi_financial_*` tables |
| Staff identities | `auth.users`, `public.fi_users`, `public.fi_os_identities`, `public.fi_staff`, `public.fi_staff_source_ids`, `public.fi_staff_pins` |
| Access grants | `public.fi_staff_access_grants`, `public.fi_staff_feature_access_audit_events`, `public.fi_staff_role_templates`, `public.fi_staff_feature_templates`, `public.fi_tenant_admin_users` |
| Rosters | `public.fi_staff_standard_hours`, `public.fi_roster_*`, `public.fi_staff_time_clock_*`, `public.fi_staff_leave_*` where present |
| Imaging | `public.fi_patient_images`, `public.fi_patient_image_regions`, `public.fi_imaging_sessions`, `public.fi_imaging_ai_analysis_jobs`, `public.fi_imaging_graft_tray_links`, `public.fi_imaging_graft_tray_ai_estimates` |
| Pathology | `public.fi_pathology_requests`, `public.fi_pathology_results`, `public.fi_pathology_ai_interpretations`, `public.fi_pathology_inbound_documents`, `public.fi_pathology_extraction_jobs`, `public.fi_pathology_email_routes` |
| Audit / event logs | `public.fi_audits`, `public.fi_intelligence_event_logs`, `public.fi_intelligence_replay_runs`, `public.fi_integration_webhook_events`, `public.platform_event_bus_events`, `public.platform_event_bus_subscribers` |
| Migration history | `supabase_migrations.schema_migrations` |
| Storage buckets | `storage.buckets`; known buckets include intakes (`FI_STORAGE_BUCKET_INTAKES` / `fi-intakes`), patient images, tenant branding, financial documents |

## Environment variable names

Core Supabase/App: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FI_BASE_URL`, `FI_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `FI_ADMIN_API_KEY`.

Restore drill: `FI_RESTORE_SUPABASE_URL`, `FI_RESTORE_SUPABASE_SERVICE_ROLE_KEY`, `FI_RESTORE_SUPABASE_ANON_KEY`, `FI_DRILL_CONFIRM_NON_PRODUCTION`, `FI_DRILL_EXPECTED_PROJECT_REF`, `FI_DRILL_EXPECTED_*`, `FI_DRILL_PRE_RECOVERY_MARKER_ID`, `FI_DRILL_POST_RECOVERY_MARKER_ID`.

Smoke/E2E: `FI_SMOKE_TENANT_ID`, `EVOLVED_PERTH_TENANT_ID`, `FI_E2E_BASE_URL`, `FI_E2E_TENANT_ID`, `FI_E2E_DEMO_ADMIN_EMAIL`, `FI_E2E_DEMO_ADMIN_PASSWORD`, `FI_E2E_ALLOW_MUTATIONS`.

Side-effect controls: `RECEPTION_OS_COMMUNICATION_DRY_RUN`, `RECEPTION_OS_EMAIL_SEND_ENABLED`, `RECEPTION_OS_SMS_SEND_ENABLED`, `FI_PAYMENT_PROVIDER`, `FI_PAYMENTS_ENABLED`, `FI_REMINDERS_LIVE_DELIVERY`, `FI_REMINDERS_TEST_SEND`, `PATHOLOGY_EMAIL_INGESTION_ENABLED`, `PATHOLOGY_EXTRACTION_ENABLED`, `PATHOLOGY_AUTO_DRAFT_ENABLED`, `GENERIC_CLINIC_EMAIL_INGESTION_ENABLED`, `FI_ACCOUNTING_LIVE_PUSH`, `FI_GOOGLE_CALENDAR_SYNC_CRON_DISABLED`.

Integrations/secrets: `CRON_SECRET`, `FI_REMINDER_CRON_SECRET`, `FI_PAYMENTS_CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, `FI_HR_SYNC_CRON_SECRET`, `WORKFORCE_COMPLIANCE_CRON_SECRET`, `FI_TIMELY_WEBHOOK_SECRET`, `FI_HUBSPOT_WEBHOOK_SECRET`, `FI_HUBSPOT_CLIENT_SECRET`, `FI_EXTERNAL_CONNECTOR_MASTER_KEY`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`, `GOOGLE_CALENDAR_OAUTH_STATE_SECRET`, `FI_GOOGLE_CALENDAR_WEBHOOK_SECRET`, `IIOHR_HR_SYNC_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `OPENAI_API_KEY`.

## Routes and integration surfaces

Cron routes include `/api/cron/fi-reminder-jobs`, `/api/cron/fi-imaging-ai-analysis`, `/api/cron/fi-photo-protocol-alerts`, `/api/cron/google-calendar/sync`, `/api/cron/leadflow/process-hubspot-events`, `/api/cron/platform-events/process`, `/api/cron/reports/scheduled-runs`, `/api/cron/financial-os/automation`, `/api/cron/financial-os/clearance-snapshots`, `/api/cron/financial-os/expense-ocr`, `/api/cron/financial-os/pathway-task-escalation`, `/api/cron/iiohr-hr-perth-staff-sync`, `/api/cron/workforce-compliance-audit`, and `/api/cron/workforce-time-clock-auto-close`.

Webhook/inbound routes include `/api/tenants/[tenantId]/integrations/hubspot/webhook`, `/api/tenants/[tenantId]/integrations/hubspot/email-event`, `/api/tenants/[tenantId]/integrations/timely/patient`, `/api/tenants/[tenantId]/integrations/timely/appointment`, `/api/tenants/[tenantId]/integrations/timely/discovery`, `/api/tenants/[tenantId]/integrations/generic-email/ingest`, `/api/integrations/pathology-email/inbound`, `/api/fi-payments/stripe/webhook`, and Google Calendar OAuth / webhook subscription routes.

Outbound/live integrations to isolate: Resend, Twilio, Stripe, HubSpot, Timely, Google Calendar, IIOHR HR sync, generic/pathology email ingestion, OpenAI/AWS/GCP OCR or AI providers, IndexNow, accounting/live push.

## Validation sequence

1. Confirm production marker evidence exists: `docs/production/evidence/blk-sec-01-recovery-marker-2026-07-14.md`.
2. In Supabase dashboard, restore production to a new isolated project only. Record selected recovery point, request time, and available time.
3. Configure local restore-only env using `.env.restore-drill.example`; do not copy production service role into the drill variables.
4. Run `npm run audit:restore-drill`. The database validator must refuse production and write local JSON evidence.
5. Run `scripts/dr/validate-restored-application.ts` only after the restored app is pointed at the isolated project and all side effects are disabled.
6. Perform Storage validation separately. Database restore evidence does not prove Storage binary recovery.
7. Complete `docs/security/fi-security-restore-drill-1.md` with evidence paths, RPO/RTO values, E4/E5/E6 verdict, and cleanup confirmation.

## Storage recovery notes

Inventory `storage.buckets` in the restored project, then validate binaries through a separate Storage restore or bucket/prefix copy. Critical asset classes are intake uploads, patient/scalp images, pathology PDFs, financial documents, report outputs, and tenant branding assets. Signed URL tests must use staging keys and redact signed tokens from evidence.

## Existing reusable checks

- Marker check: `scripts/verify-blk-sec-01-recovery-marker.ts`.
- Staff mapping audit: `scripts/audit-staff-mapping-completeness.ts`.
- Read-only production-style smoke: `scripts/fi-production-smoke-test.ts`.
- Operational day smoke: `scripts/run-fi-operational-day-smoke.mjs`; mutation mode requires `FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1` and must only run on restored non-production.
- E2E smoke/security wrappers: `scripts/run-e2e-smoke-production.mjs`, `scripts/run-e2e-security-production.mjs`.

## Exact operator steps for dashboard restore

1. Open Supabase Dashboard for production project `iqqvzgxoimxchhcnbzxl`.
2. Navigate to backups / PITR and choose a restore timestamp strictly after `2026-07-14T06:21:38.292Z` and inside the current retention window.
3. Choose the dashboard option that restores or clones to a new project. Do not choose any in-place production restore option.
4. Name the target clearly, for example `fi-os-restore-drill-YYYY-MM-DD`.
5. Wait for the new project to become healthy and note the new project ref.
6. Create local restore-drill env values with the new project URL/ref and service key.
7. Keep outbound integrations, cron, webhooks, email, SMS, payment, and live AI/OCR provider settings disabled.
8. Run the repository validators and paste the local evidence summaries into the findings template.
