# DANGEROUS rows from `audit-supabase-admin-from.result.csv`

Source: `tools/audit-supabase-admin-from.result.csv` (regenerated audit). **88** rows rated `DANGEROUS` (between `SAFE` and `CRITICAL` in this tool’s scale). For the stricter `CRITICAL` disposition table, see `tools/audit-supabase-admin-from.critical-review.md`.

**Event links (2026-06-13):** `getLatestFiEventLink` and `linkEventToEntities` in `lib/fi/events/mapping.ts` now take `tenantId` and call `assertFiEventBelongsToTenant` before any `fi_event_links` access. The scanner may still list those lines as `DANGEROUS` because the `fi_event_links` chain lacks `tenant_id`. Tests: `lib/fi/events/eventLinksTenantAssert.test.ts`.

This document groups every row into a **single primary bucket** for triage. It is a **static** review: heuristics flag “service role + no `tenant_id` on the matched query chain”, even when tenant is carried in insert payloads, prior reads, OR filters, or when the surface is intentionally cross-tenant (system admin, cron, global catalogue).

**Legend**

| Bucket | Meaning |
|--------|---------|
| **false positive** | Tenant or user scope is present but not in the shape the scanner matches (e.g. `auth_user_id`, `public_token`, `OR tenant_id …`). |
| **safe by prior ownership check** | Same function or call chain already established tenant/case/batch scope; flagged line omits redundant `tenant_id`. |
| **insert/upsert safe** | Write carries `tenant_id` (or FK to a tenant-scoped parent) in the payload object; snippet does not show it. |
| **tenant-global/tooling** | Intentionally cross-tenant, global catalogue, aggregate, script, or operator console — policy/auth is the control, not row filters. |
| **needs tenant_id filter** | Add `.eq('tenant_id', …)` (or join) on the flagged chain for defense-in-depth or clarity **if** IDs could be wrong. |
| **needs ownership assertion** | Add explicit assert (or join through `fi_events` / case) so IDs cannot cross tenants if misrouted. |
| **needs service-role wrapper** | Prefer one audited helper for “service role + pattern X” (optional hygiene; **none mandatory** in this pass). |
| **true dangerous** | Plausible cross-tenant read/write if deployed without the assumed auth/route controls (**none** classified here by default — see notes). |

---

## Summary counts

| Bucket | Rows |
|--------|-----:|
| insert/upsert safe | 37 |
| tenant-global/tooling | 23 |
| safe by prior ownership check | 17 |
| false positive | 10 |
| needs tenant_id filter | 1 |

Buckets with **0** rows in this classifier pass: **needs ownership assertion**, **needs service-role wrapper**, **true dangerous**.

---

## Grouped disposition

### false positive (10)

- **`src/lib/fi-os/organisationalProfile.server.ts`** — line **81** — table `fi_staff_feature_templates` — `loadFiStaffFeatureTemplateByKey`  
  Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope.

- **`src/lib/fi-os/organisationalProfile.tenantMode.server.ts`** — line **32** — table `fi_tenant_operating_modes` — `loadTenantOperatingModeRowByKey`  
  Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope.

- **`src/lib/fiAdmin/fiAdminTenantDirectory.ts`** — line **17** — table `fi_users` — `loadTenantsForAuthUser`  
  Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table.

- **`src/lib/fiOs/fiOsIdentity.server.ts`** — line **26** — table `fi_users` — `hasAnyFiUsersMembership`  
  Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table.

- **`src/lib/fiOs/fiOsIdentity.server.ts`** — line **45** — table `fi_users` — `loadFirstTenantIdForAuthUser`  
  Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table.

- **`src/lib/fiOs/fiOsImpersonation.server.ts`** — line **43** — table `fi_os_impersonation_sessions` — `endOpenFiOsImpersonationSessions`  
  Update filters by `initiator_auth_user_id` — scoped to the authenticated initiator’s sessions.

- **`src/lib/imagingOs/imagingOsGuidedCapture.server.ts`** — line **68** — table `fi_imaging_protocol_templates` — `loadProtocolTemplateBySlug`  
  Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope.

- **`src/lib/revenueOs/publicPaymentRequestLoaders.server.ts`** — line **36** — table `fi_payment_requests` — `loadPublicPaymentRequestView`  
  Public payment view is scoped by `public_token`, not `tenant_id` on the chain.

- **`src/lib/staffPin/staffPinSession.server.ts`** — line **133** — table `fi_staff_pin_sessions` — `endStaffPinClinicSession`  
  Row scope is the unguessable `session_token` (capability URL), analogous to public payment tokens.

- **`src/lib/staffPin/staffPinSession.server.ts`** — line **47** — table `fi_staff_pin_sessions` — `loadActiveSessionRow`  
  Row scope is the unguessable `session_token` (capability URL), analogous to public payment tokens.

### safe by prior ownership check (17)

- **`lib/fi/events/mapping.ts`** — line **146** — table `fi_event_links` — `getLatestFiEventLink`  
  **Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains.

- **`lib/fi/events/mapping.ts`** — line **452** — table `fi_event_links` — `linkEventToEntities`  
  **Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains.

- **`lib/fi/events/mapping.ts`** — line **467** — table `fi_event_links` — `linkEventToEntities`  
  **Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains.

- **`lib/fi/pipeline.ts`** — line **146** — table `fi_uploads` — `(top-level or unscoped)`  
  Same function already loaded `fi_cases` with `.eq('tenant_id', tenantId)`; uploads filtered by `case_id` from that scope. Optional `.eq('tenant_id', tenantId)` for defense-in-depth.

- **`src/lib/clinicSetup/clinicSetupWizard.server.ts`** — line **144** — table `fi_service_staff_eligibility` — `deleteWizardStaffEligibilityForServices`  
  `ids` for delete come from prior selects scoped to the wizard’s tenant/clinic in the same module.

- **`src/lib/clinicSetup/clinicSetupWizard.server.ts`** — line **168** — table `fi_service_room_eligibility` — `deleteWizardRoomEligibilityForServices`  
  `ids` for delete come from prior selects scoped to the wizard’s tenant/clinic in the same module.

- **`src/lib/consultationForms/consultationFormMutations.server.ts`** — line **117** — table `fi_consultation_form_template_versions` — `(top-level or unscoped)`  
  Selects constrained by `template_id` / `status` after template row resolved in-function.

- **`src/lib/consultationForms/consultationFormMutations.server.ts`** — line **90** — table `fi_consultation_form_template_versions` — `(top-level or unscoped)`  
  Selects constrained by `template_id` / `status` after template row resolved in-function.

- **`src/lib/crm/hubspotImport/hubspotImportBatchLoad.server.ts`** — line **120** — table `stg_hubspot_contacts_imports` — `loadAllStagingRowsForBatch`  
  `import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`.

- **`src/lib/crm/hubspotImport/hubspotImportBatchLoad.server.ts`** — line **87** — table `stg_hubspot_contacts_imports` — `loadHubspotImportBatch`  
  `import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`.

- **`src/lib/crm/hubspotImport/hubspotImportBatchLoad.server.ts`** — line **93** — table `stg_hubspot_contacts_imports` — `loadHubspotImportBatch`  
  `import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`.

- **`src/lib/fi/foundation/integrity.ts`** — line **108** — table `fi_event_links` — `buildEventToCaseMap`  
  `event_id` values come from `listFiEventIdsForTenant` (tenant-filtered `fi_events` enumeration).

- **`src/lib/fiOs/tenantOperationalDashboardLoader.server.ts`** — line **404** — table `fi_persons` — `loadStaleLeads`  
  `person_id` set is derived from `fi_crm_leads` queried with `.eq('tenant_id', tid)` in the same function.

- **`src/lib/hair-intelligence/hairLossClassification/adapters/fiOsHairLossClassification.server.ts`** — line **27** — table `hli_image_classifications` — `latestImageClassificationIdForFiPatientImage`  
  `patientImageId` should only be used after `fi_patient_images` tenant-scoped validation in calling paths (defense-in-depth: add tenant join if ever exposed wider).

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **150** — table `hli_photo_protocol_session_slots` — `loadLatestActivePhotoSessionForPatient`  
  Reads use `session_id` / template id from session or template already resolved under tenant checks in callers.

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **344** — table `hli_photo_protocol_session_slots` — `completePhotoProtocolSessionIfEligible`  
  Reads use `session_id` / template id from session or template already resolved under tenant checks in callers.

- **`src/lib/reminders/reminderJobs.server.ts`** — line **467** — table `fi_persons` — `(top-level or unscoped)`  
  `personIdsNeeded` populated from tenant-scoped `fi_crm_leads` and reminder job rows for that tenant batch.

### insert/upsert safe (37)

- **`app/api/fi/cases/route.ts`** — line **116** — table `fi_intakes` — `(top-level or unscoped)`  
  `assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload.

- **`app/api/fi/cases/route.ts`** — line **129** — table `fi_referrals` — `(top-level or unscoped)`  
  Referral upsert is keyed to `case_id` created in the same request under `tenant_id`; partner resolved with `.eq('tenant_id', tenant_id)`.

- **`app/api/fi/cases/route.ts`** — line **70** — table `fi_cases` — `(top-level or unscoped)`  
  `assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload.

- **`app/api/fi/cases/route.ts`** — line **81** — table `fi_cases` — `(top-level or unscoped)`  
  `assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload.

- **`app/api/fi/partners/route.ts`** — line **48** — table `fi_partners` — `(top-level or unscoped)`  
  Insert literal includes `tenant_id` in snippet; legacy API gated by `assertLegacyFiApiAccess`.

- **`app/api/fi/uploads/route.ts`** — line **101** — table `fi_uploads` — `(top-level or unscoped)`  
  `inserts` built with `tenant_id` and `case_id` after `fi_cases` verified with `.eq('tenant_id', tenant_id)`.

- **`lib/actions/fi-prescribing-actions.ts`** — line **195** — table `fi_prescription_items` — `(top-level or unscoped)`  
  `rows` objects include `tenant_id: tid` built in the same block; snippet-only audit misses payload fields.

- **`lib/actions/fi-prescribing-actions.ts`** — line **256** — table `fi_prescription_items` — `(top-level or unscoped)`  
  `rows` objects include `tenant_id: tid` built in the same block; snippet-only audit misses payload fields.

- **`lib/fi/events/mapping.ts`** — line **587** — table `fi_intakes` — `(top-level or unscoped)`  
  `ensureFiIntake` builds `row` with `tenant_id: input.tenantId` before upsert.

- **`src/lib/bookings/bookings.ts`** — line **720** — table `fi_bookings` — `(top-level or unscoped)`  
  `insertRow` includes tenant and clinic identifiers from booking creation flow.

- **`src/lib/cases/postOpUpdate.ts`** — line **119** — table `fi_case_post_op_tracking` — `(top-level or unscoped)`  
  Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint.

- **`src/lib/cases/postOpUpdate.ts`** — line **227** — table `fi_case_follow_ups` — `(top-level or unscoped)`  
  Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint.

- **`src/lib/cases/procedureDayUpdate.ts`** — line **161** — table `fi_case_procedures` — `(top-level or unscoped)`  
  Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint.

- **`src/lib/cases/surgeryPlanningUpdate.ts`** — line **95** — table `fi_case_surgery_plans` — `(top-level or unscoped)`  
  Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint.

- **`src/lib/clinicSetup/clinicSetupWizard.server.ts`** — line **388** — table `fi_clinic_settings` — `(top-level or unscoped)`  
  `onConflict: 'tenant_id,clinic_id'` upsert; tenant/clinic provenance from wizard context.

- **`src/lib/consultationForms/consultationFormMutations.server.ts`** — line **103** — table `fi_consultation_form_template_versions` — `(top-level or unscoped)`  
  Template version insert is tied to `templateId` resolved from global template lookup in the same flow.

- **`src/lib/consultations/consultationMutations.server.ts`** — line **136** — table `fi_consultations` — `(top-level or unscoped)`  
  Server mutation builds `insertRow` with tenant/booking scope from validated wizard/API inputs (verify callers pass tenant).

- **`src/lib/crm/pipeline.ts`** — line **102** — table `fi_crm_pipeline_stages` — `(top-level or unscoped)`  
  `insertRows` constructed with tenant from CRM setup context (admin path).

- **`src/lib/fi-os/clinicalIntelligenceEvents.server.ts`** — line **45** — table `fi_clinical_intelligence_events` — `recordClinicalIntelligenceEvent`  
  Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording.

- **`src/lib/fi-os/outcomeIntelligenceEvents.server.ts`** — line **55** — table `fi_patient_outcome_measurements` — `recordOutcomeMeasurement`  
  Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording.

- **`src/lib/fi-os/outcomeIntelligenceEvents.server.ts`** — line **83** — table `fi_outcome_protocols` — `recordOutcomeProtocol`  
  Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording.

- **`src/lib/fi/foundation/resolveClinic.ts`** — line **118** — table `fi_clinics` — `(top-level or unscoped)`  
  `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source.

- **`src/lib/fi/foundation/resolveOrganisation.ts`** — line **118** — table `fi_organisations` — `(top-level or unscoped)`  
  `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source.

- **`src/lib/fi/foundation/resolveOrganisation.ts`** — line **125** — table `fi_organisations` — `(top-level or unscoped)`  
  `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source.

- **`src/lib/fi/foundation/resolvePatient.ts`** — line **155** — table `fi_patients` — `(top-level or unscoped)`  
  `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source.

- **`src/lib/hair-intelligence/photoProtocols/protocolAlertEvents.server.ts`** — line **142** — table `hli_photo_protocol_alert_events` — `(top-level or unscoped)`  
  Upsert slices include tenant/session identifiers and idempotency keys from alert builder.

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **214** — table `hli_photo_protocol_session_slots` — `createFiOsPhotoProtocolSession`  
  Session slot inserts follow session row created under `tenant_id` for the patient.

- **`src/lib/imagingOs/imagingOsMutations.server.ts`** — line **122** — table `fi_imaging_scalp_maps` — `(top-level or unscoped)`  
  Imaging insert scoped to tenant/patient from mutation parameters.

- **`src/lib/integrations/timely/timelyWebhookEvents.server.ts`** — line **77** — table `fi_integration_webhook_events` — `insertTimelyZapierDiscoveryWebhookEvent`  
  Webhook event row includes tenant/integration identifiers from webhook handler context.

- **`src/lib/pathology/pathologyRequestMutations.server.ts`** — line **120** — table `fi_pathology_request_items` — `createPathologyRequest`  
  Pathology item inserts follow request header with tenant/case linkage.

- **`src/lib/reminders/reminderEnqueue.server.ts`** — line **118** — table `fi_reminder_jobs` — `(top-level or unscoped)`  
  `rows` built with `tenant_id` per job enqueue path.

- **`src/lib/reminders/reminderEnqueue.server.ts`** — line **173** — table `fi_reminder_jobs` — `(top-level or unscoped)`  
  `rows` built with `tenant_id` per job enqueue path.

- **`src/lib/reminders/reminderEnqueue.server.ts`** — line **232** — table `fi_reminder_jobs` — `(top-level or unscoped)`  
  `rows` built with `tenant_id` per job enqueue path.

- **`src/lib/revenueOs/revenueInvoiceMutations.server.ts`** — line **120** — table `fi_invoices` — `(top-level or unscoped)`  
  Invoice insert includes tenant from revenue mutation context.

- **`src/lib/staff/staff.server.ts`** — line **238** — table `fi_staff` — `insertFiStaff`  
  `payload` includes `tenant_id` for staff insert; snippet does not expand object literal.

- **`src/lib/staffImport/iiohrHrStaffImportRunner.ts`** — line **342** — table `fi_staff` — `insertFiStaffRow`  
  `payload` includes `tenant_id` for staff insert; snippet does not expand object literal.

- **`src/lib/taxLocalisation/taxLocalisationSettings.server.ts`** — line **149** — table `fi_tax_localisation_settings` — `(top-level or unscoped)`  
  `rowPayload` includes `tenant_id` / clinic scope from `upsertTaxLocalisationDocument` args.

### tenant-global/tooling (23)

- **`app/(fi-admin)/fi-admin/system/academy/page.tsx`** — line **11** — table `fi_staff_source_ids` — `(top-level or unscoped)`  
  FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.

- **`app/(fi-admin)/fi-admin/system/audit-logs/page.tsx`** — line **11** — table `fi_os_impersonation_sessions` — `(top-level or unscoped)`  
  FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.

- **`app/(fi-admin)/fi-admin/system/clinics/page.tsx`** — line **11** — table `fi_clinics` — `(top-level or unscoped)`  
  FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.

- **`app/(fi-admin)/fi-admin/system/medication-catalogue/page.tsx`** — line **11** — table `fi_medication_catalogue` — `(top-level or unscoped)`  
  FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.

- **`app/(fi-admin)/fi-admin/system/services/page.tsx`** — line **14** — table `fi_services` — `(top-level or unscoped)`  
  FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.

- **`app/(fi-admin)/fi-admin/system/staff/page.tsx`** — line **14** — table `fi_staff` — `(top-level or unscoped)`  
  FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.

- **`scripts/hubspot-commit-latest-dry-run-batch.ts`** — line **154** — table `stg_hubspot_contacts_imports` — `bootstrapBatchFromCsv`  
  Repository script (provisioning / import tooling); not an end-user HTTP surface.

- **`scripts/hubspot-commit-latest-dry-run-batch.ts`** — line **191** — table `fi_import_batches` — `main`  
  Repository script (provisioning / import tooling); not an end-user HTTP surface.

- **`scripts/provision-evolved-tenant.ts`** — line **247** — table `fi_crm_pipeline_stages` — `(top-level or unscoped)`  
  Repository script (provisioning / import tooling); not an end-user HTTP surface.

- **`scripts/provision-evolved-tenant.ts`** — line **281** — table `fi_reminder_templates` — `(top-level or unscoped)`  
  Repository script (provisioning / import tooling); not an end-user HTTP surface.

- **`scripts/provision-evolved-tenant.ts`** — line **376** — table `fi_services` — `(top-level or unscoped)`  
  Repository script (provisioning / import tooling); not an end-user HTTP surface.

- **`src/lib/consultationForms/consultationFormMutations.server.ts`** — line **50** — table `fi_consultation_form_templates` — `ensureGlobalHairTransplantConsultationTemplate`  
  Global catalogue templates use `.is('tenant_id', null)` — intentional platform-wide form definitions.

- **`src/lib/consultationForms/consultationFormMutations.server.ts`** — line **76** — table `fi_consultation_form_templates` — `ensureGlobalHairTransplantConsultationTemplate`  
  Global catalogue templates use `.is('tenant_id', null)` — intentional platform-wide form definitions.

- **`src/lib/fi-os/outcomeIntelligence.server.ts`** — line **148** — table `fi_global_outcome_aggregates` — `loadGlobalOutcomeAggregateSummary`  
  Anonymised / aggregate outcome intelligence tables; not per-patient tenant row reads.

- **`src/lib/fi-os/outcomeIntelligence.server.ts`** — line **177** — table `fi_global_outcome_aggregates` — `loadTenantOutcomeIntelligenceSummary`  
  Anonymised / aggregate outcome intelligence tables; not per-patient tenant row reads.

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **100** — table `hli_photo_protocol_slots` — `loadTemplateWithSlotsBySlug`  
  Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer).

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **117** — table `hli_photo_protocol_slots` — `loadTemplateWithSlotsByTemplateId`  
  Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer).

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **156** — table `hli_photo_protocol_slots` — `loadLatestActivePhotoSessionForPatient`  
  Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer).

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **349** — table `hli_photo_protocol_slots` — `completePhotoProtocolSessionIfEligible`  
  Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer).

- **`src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts`** — line **92** — table `hli_photo_protocol_templates` — `loadTemplateWithSlotsBySlug`  
  Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer).

- **`src/lib/patientTwin/patientTwinHairProgression.server.ts`** — line **46** — table `hair_intelligence_progression_network_buckets` — `loadLatestNetworkBucketForCohort`  
  Coalition/network aggregate bucket keyed by cohort signature — not a direct tenant-row listing.

- **`src/lib/reminders/reminderProcessor.server.ts`** — line **219** — table `fi_reminder_jobs` — `processReminderJobsOnce`  
  Worker dequeue lists pending jobs across tenants by design; per-job `tenant_id` is carried on the row for downstream tenant-scoped work.

- **`src/lib/revenueOs/fiPaymentRemindersCron.server.ts`** — line **48** — table `fi_invoices` — `(top-level or unscoped)`  
  Cron-style sweep over invoices across tenants; must be restricted to trusted scheduler/cron identity (not a user-facing list API).

### needs tenant_id filter (1)

- **`src/lib/hair-intelligence/donorIntelligence/adapters/fiOsDonorAssessment.server.ts`** — line **26** — table `hli_image_classifications` — `latestDonorImageClassificationIdForFiPatientImage`  
  Default: service-role chain lacks explicit `tenant_id` in the matched snippet; triage further — may be defense-in-depth only, or promote to ownership assert / wrapper if IDs are externally influenced.

---

## Full row index (88)

| # | File | Line | Function | Table | Primary bucket | Notes |
|---|------|------|----------|-------|----------------|-------|
| 1 | `app/(fi-admin)/fi-admin/system/academy/page.tsx` | 11 | `(top-level or unscoped)` | `fi_staff_source_ids` | tenant-global/tooling | FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters. |
| 2 | `app/(fi-admin)/fi-admin/system/audit-logs/page.tsx` | 11 | `(top-level or unscoped)` | `fi_os_impersonation_sessions` | tenant-global/tooling | FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters. |
| 3 | `app/(fi-admin)/fi-admin/system/clinics/page.tsx` | 11 | `(top-level or unscoped)` | `fi_clinics` | tenant-global/tooling | FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters. |
| 4 | `app/(fi-admin)/fi-admin/system/medication-catalogue/page.tsx` | 11 | `(top-level or unscoped)` | `fi_medication_catalogue` | tenant-global/tooling | FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters. |
| 5 | `app/(fi-admin)/fi-admin/system/services/page.tsx` | 14 | `(top-level or unscoped)` | `fi_services` | tenant-global/tooling | FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters. |
| 6 | `app/(fi-admin)/fi-admin/system/staff/page.tsx` | 14 | `(top-level or unscoped)` | `fi_staff` | tenant-global/tooling | FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters. |
| 7 | `app/api/fi/cases/route.ts` | 116 | `(top-level or unscoped)` | `fi_intakes` | insert/upsert safe | `assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload. |
| 8 | `app/api/fi/cases/route.ts` | 129 | `(top-level or unscoped)` | `fi_referrals` | insert/upsert safe | Referral upsert is keyed to `case_id` created in the same request under `tenant_id`; partner resolved with `.eq('tenant_id', tenant_id)`. |
| 9 | `app/api/fi/cases/route.ts` | 70 | `(top-level or unscoped)` | `fi_cases` | insert/upsert safe | `assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload. |
| 10 | `app/api/fi/cases/route.ts` | 81 | `(top-level or unscoped)` | `fi_cases` | insert/upsert safe | `assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload. |
| 11 | `app/api/fi/partners/route.ts` | 48 | `(top-level or unscoped)` | `fi_partners` | insert/upsert safe | Insert literal includes `tenant_id` in snippet; legacy API gated by `assertLegacyFiApiAccess`. |
| 12 | `app/api/fi/uploads/route.ts` | 101 | `(top-level or unscoped)` | `fi_uploads` | insert/upsert safe | `inserts` built with `tenant_id` and `case_id` after `fi_cases` verified with `.eq('tenant_id', tenant_id)`. |
| 13 | `lib/actions/fi-prescribing-actions.ts` | 195 | `(top-level or unscoped)` | `fi_prescription_items` | insert/upsert safe | `rows` objects include `tenant_id: tid` built in the same block; snippet-only audit misses payload fields. |
| 14 | `lib/actions/fi-prescribing-actions.ts` | 256 | `(top-level or unscoped)` | `fi_prescription_items` | insert/upsert safe | `rows` objects include `tenant_id: tid` built in the same block; snippet-only audit misses payload fields. |
| 15 | `lib/fi/events/mapping.ts` | 146 | `getLatestFiEventLink` | `fi_event_links` | safe by prior ownership check | **Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains. |
| 16 | `lib/fi/events/mapping.ts` | 452 | `linkEventToEntities` | `fi_event_links` | safe by prior ownership check | **Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains. |
| 17 | `lib/fi/events/mapping.ts` | 467 | `linkEventToEntities` | `fi_event_links` | safe by prior ownership check | **Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains. |
| 18 | `lib/fi/events/mapping.ts` | 587 | `(top-level or unscoped)` | `fi_intakes` | insert/upsert safe | `ensureFiIntake` builds `row` with `tenant_id: input.tenantId` before upsert. |
| 19 | `lib/fi/pipeline.ts` | 146 | `(top-level or unscoped)` | `fi_uploads` | safe by prior ownership check | Same function already loaded `fi_cases` with `.eq('tenant_id', tenantId)`; uploads filtered by `case_id` from that scope. Optional `.eq('tenant_id', tenantId)` for defense-in-depth. |
| 20 | `scripts/hubspot-commit-latest-dry-run-batch.ts` | 154 | `bootstrapBatchFromCsv` | `stg_hubspot_contacts_imports` | tenant-global/tooling | Repository script (provisioning / import tooling); not an end-user HTTP surface. |
| 21 | `scripts/hubspot-commit-latest-dry-run-batch.ts` | 191 | `main` | `fi_import_batches` | tenant-global/tooling | Repository script (provisioning / import tooling); not an end-user HTTP surface. |
| 22 | `scripts/provision-evolved-tenant.ts` | 247 | `(top-level or unscoped)` | `fi_crm_pipeline_stages` | tenant-global/tooling | Repository script (provisioning / import tooling); not an end-user HTTP surface. |
| 23 | `scripts/provision-evolved-tenant.ts` | 281 | `(top-level or unscoped)` | `fi_reminder_templates` | tenant-global/tooling | Repository script (provisioning / import tooling); not an end-user HTTP surface. |
| 24 | `scripts/provision-evolved-tenant.ts` | 376 | `(top-level or unscoped)` | `fi_services` | tenant-global/tooling | Repository script (provisioning / import tooling); not an end-user HTTP surface. |
| 25 | `src/lib/bookings/bookings.ts` | 720 | `(top-level or unscoped)` | `fi_bookings` | insert/upsert safe | `insertRow` includes tenant and clinic identifiers from booking creation flow. |
| 26 | `src/lib/cases/postOpUpdate.ts` | 119 | `(top-level or unscoped)` | `fi_case_post_op_tracking` | insert/upsert safe | Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint. |
| 27 | `src/lib/cases/postOpUpdate.ts` | 227 | `(top-level or unscoped)` | `fi_case_follow_ups` | insert/upsert safe | Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint. |
| 28 | `src/lib/cases/procedureDayUpdate.ts` | 161 | `(top-level or unscoped)` | `fi_case_procedures` | insert/upsert safe | Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint. |
| 29 | `src/lib/cases/surgeryPlanningUpdate.ts` | 95 | `(top-level or unscoped)` | `fi_case_surgery_plans` | insert/upsert safe | Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint. |
| 30 | `src/lib/clinicSetup/clinicSetupWizard.server.ts` | 144 | `deleteWizardStaffEligibilityForServices` | `fi_service_staff_eligibility` | safe by prior ownership check | `ids` for delete come from prior selects scoped to the wizard’s tenant/clinic in the same module. |
| 31 | `src/lib/clinicSetup/clinicSetupWizard.server.ts` | 168 | `deleteWizardRoomEligibilityForServices` | `fi_service_room_eligibility` | safe by prior ownership check | `ids` for delete come from prior selects scoped to the wizard’s tenant/clinic in the same module. |
| 32 | `src/lib/clinicSetup/clinicSetupWizard.server.ts` | 388 | `(top-level or unscoped)` | `fi_clinic_settings` | insert/upsert safe | `onConflict: 'tenant_id,clinic_id'` upsert; tenant/clinic provenance from wizard context. |
| 33 | `src/lib/consultationForms/consultationFormMutations.server.ts` | 103 | `(top-level or unscoped)` | `fi_consultation_form_template_versions` | insert/upsert safe | Template version insert is tied to `templateId` resolved from global template lookup in the same flow. |
| 34 | `src/lib/consultationForms/consultationFormMutations.server.ts` | 117 | `(top-level or unscoped)` | `fi_consultation_form_template_versions` | safe by prior ownership check | Selects constrained by `template_id` / `status` after template row resolved in-function. |
| 35 | `src/lib/consultationForms/consultationFormMutations.server.ts` | 50 | `ensureGlobalHairTransplantConsultationTemplate` | `fi_consultation_form_templates` | tenant-global/tooling | Global catalogue templates use `.is('tenant_id', null)` — intentional platform-wide form definitions. |
| 36 | `src/lib/consultationForms/consultationFormMutations.server.ts` | 76 | `ensureGlobalHairTransplantConsultationTemplate` | `fi_consultation_form_templates` | tenant-global/tooling | Global catalogue templates use `.is('tenant_id', null)` — intentional platform-wide form definitions. |
| 37 | `src/lib/consultationForms/consultationFormMutations.server.ts` | 90 | `(top-level or unscoped)` | `fi_consultation_form_template_versions` | safe by prior ownership check | Selects constrained by `template_id` / `status` after template row resolved in-function. |
| 38 | `src/lib/consultations/consultationMutations.server.ts` | 136 | `(top-level or unscoped)` | `fi_consultations` | insert/upsert safe | Server mutation builds `insertRow` with tenant/booking scope from validated wizard/API inputs (verify callers pass tenant). |
| 39 | `src/lib/crm/hubspotImport/hubspotImportBatchLoad.server.ts` | 120 | `loadAllStagingRowsForBatch` | `stg_hubspot_contacts_imports` | safe by prior ownership check | `import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`. |
| 40 | `src/lib/crm/hubspotImport/hubspotImportBatchLoad.server.ts` | 87 | `loadHubspotImportBatch` | `stg_hubspot_contacts_imports` | safe by prior ownership check | `import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`. |
| 41 | `src/lib/crm/hubspotImport/hubspotImportBatchLoad.server.ts` | 93 | `loadHubspotImportBatch` | `stg_hubspot_contacts_imports` | safe by prior ownership check | `import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`. |
| 42 | `src/lib/crm/pipeline.ts` | 102 | `(top-level or unscoped)` | `fi_crm_pipeline_stages` | insert/upsert safe | `insertRows` constructed with tenant from CRM setup context (admin path). |
| 43 | `src/lib/fi-os/clinicalIntelligenceEvents.server.ts` | 45 | `recordClinicalIntelligenceEvent` | `fi_clinical_intelligence_events` | insert/upsert safe | Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording. |
| 44 | `src/lib/fi-os/organisationalProfile.server.ts` | 81 | `loadFiStaffFeatureTemplateByKey` | `fi_staff_feature_templates` | false positive | Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope. |
| 45 | `src/lib/fi-os/organisationalProfile.tenantMode.server.ts` | 32 | `loadTenantOperatingModeRowByKey` | `fi_tenant_operating_modes` | false positive | Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope. |
| 46 | `src/lib/fi-os/outcomeIntelligence.server.ts` | 148 | `loadGlobalOutcomeAggregateSummary` | `fi_global_outcome_aggregates` | tenant-global/tooling | Anonymised / aggregate outcome intelligence tables; not per-patient tenant row reads. |
| 47 | `src/lib/fi-os/outcomeIntelligence.server.ts` | 177 | `loadTenantOutcomeIntelligenceSummary` | `fi_global_outcome_aggregates` | tenant-global/tooling | Anonymised / aggregate outcome intelligence tables; not per-patient tenant row reads. |
| 48 | `src/lib/fi-os/outcomeIntelligenceEvents.server.ts` | 55 | `recordOutcomeMeasurement` | `fi_patient_outcome_measurements` | insert/upsert safe | Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording. |
| 49 | `src/lib/fi-os/outcomeIntelligenceEvents.server.ts` | 83 | `recordOutcomeProtocol` | `fi_outcome_protocols` | insert/upsert safe | Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording. |
| 50 | `src/lib/fi/foundation/integrity.ts` | 108 | `buildEventToCaseMap` | `fi_event_links` | safe by prior ownership check | `event_id` values come from `listFiEventIdsForTenant` (tenant-filtered `fi_events` enumeration). |
| 51 | `src/lib/fi/foundation/resolveClinic.ts` | 118 | `(top-level or unscoped)` | `fi_clinics` | insert/upsert safe | `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source. |
| 52 | `src/lib/fi/foundation/resolveOrganisation.ts` | 118 | `(top-level or unscoped)` | `fi_organisations` | insert/upsert safe | `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source. |
| 53 | `src/lib/fi/foundation/resolveOrganisation.ts` | 125 | `(top-level or unscoped)` | `fi_organisations` | insert/upsert safe | `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source. |
| 54 | `src/lib/fi/foundation/resolvePatient.ts` | 155 | `(top-level or unscoped)` | `fi_patients` | insert/upsert safe | `insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source. |
| 55 | `src/lib/fiAdmin/fiAdminTenantDirectory.ts` | 17 | `loadTenantsForAuthUser` | `fi_users` | false positive | Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table. |
| 56 | `src/lib/fiOs/fiOsIdentity.server.ts` | 26 | `hasAnyFiUsersMembership` | `fi_users` | false positive | Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table. |
| 57 | `src/lib/fiOs/fiOsIdentity.server.ts` | 45 | `loadFirstTenantIdForAuthUser` | `fi_users` | false positive | Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table. |
| 58 | `src/lib/fiOs/fiOsImpersonation.server.ts` | 43 | `endOpenFiOsImpersonationSessions` | `fi_os_impersonation_sessions` | false positive | Update filters by `initiator_auth_user_id` — scoped to the authenticated initiator’s sessions. |
| 59 | `src/lib/fiOs/tenantOperationalDashboardLoader.server.ts` | 404 | `loadStaleLeads` | `fi_persons` | safe by prior ownership check | `person_id` set is derived from `fi_crm_leads` queried with `.eq('tenant_id', tid)` in the same function. |
| 60 | `src/lib/hair-intelligence/donorIntelligence/adapters/fiOsDonorAssessment.server.ts` | 26 | `latestDonorImageClassificationIdForFiPatientImage` | `hli_image_classifications` | needs tenant_id filter | Default: service-role chain lacks explicit `tenant_id` in the matched snippet; triage further — may be defense-in-depth only, or promote to ownership assert / wrapper if IDs are externally influenced. |
| 61 | `src/lib/hair-intelligence/hairLossClassification/adapters/fiOsHairLossClassification.server.ts` | 27 | `latestImageClassificationIdForFiPatientImage` | `hli_image_classifications` | safe by prior ownership check | `patientImageId` should only be used after `fi_patient_images` tenant-scoped validation in calling paths (defense-in-depth: add tenant join if ever exposed wider). |
| 62 | `src/lib/hair-intelligence/photoProtocols/protocolAlertEvents.server.ts` | 142 | `(top-level or unscoped)` | `hli_photo_protocol_alert_events` | insert/upsert safe | Upsert slices include tenant/session identifiers and idempotency keys from alert builder. |
| 63 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 100 | `loadTemplateWithSlotsBySlug` | `hli_photo_protocol_slots` | tenant-global/tooling | Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer). |
| 64 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 117 | `loadTemplateWithSlotsByTemplateId` | `hli_photo_protocol_slots` | tenant-global/tooling | Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer). |
| 65 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 150 | `loadLatestActivePhotoSessionForPatient` | `hli_photo_protocol_session_slots` | safe by prior ownership check | Reads use `session_id` / template id from session or template already resolved under tenant checks in callers. |
| 66 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 156 | `loadLatestActivePhotoSessionForPatient` | `hli_photo_protocol_slots` | tenant-global/tooling | Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer). |
| 67 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 214 | `createFiOsPhotoProtocolSession` | `hli_photo_protocol_session_slots` | insert/upsert safe | Session slot inserts follow session row created under `tenant_id` for the patient. |
| 68 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 344 | `completePhotoProtocolSessionIfEligible` | `hli_photo_protocol_session_slots` | safe by prior ownership check | Reads use `session_id` / template id from session or template already resolved under tenant checks in callers. |
| 69 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 349 | `completePhotoProtocolSessionIfEligible` | `hli_photo_protocol_slots` | tenant-global/tooling | Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer). |
| 70 | `src/lib/hair-intelligence/photoProtocols/protocolSession.server.ts` | 92 | `loadTemplateWithSlotsBySlug` | `hli_photo_protocol_templates` | tenant-global/tooling | Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer). |
| 71 | `src/lib/imagingOs/imagingOsGuidedCapture.server.ts` | 68 | `loadProtocolTemplateBySlug` | `fi_imaging_protocol_templates` | false positive | Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope. |
| 72 | `src/lib/imagingOs/imagingOsMutations.server.ts` | 122 | `(top-level or unscoped)` | `fi_imaging_scalp_maps` | insert/upsert safe | Imaging insert scoped to tenant/patient from mutation parameters. |
| 73 | `src/lib/integrations/timely/timelyWebhookEvents.server.ts` | 77 | `insertTimelyZapierDiscoveryWebhookEvent` | `fi_integration_webhook_events` | insert/upsert safe | Webhook event row includes tenant/integration identifiers from webhook handler context. |
| 74 | `src/lib/pathology/pathologyRequestMutations.server.ts` | 120 | `createPathologyRequest` | `fi_pathology_request_items` | insert/upsert safe | Pathology item inserts follow request header with tenant/case linkage. |
| 75 | `src/lib/patientTwin/patientTwinHairProgression.server.ts` | 46 | `loadLatestNetworkBucketForCohort` | `hair_intelligence_progression_network_buckets` | tenant-global/tooling | Coalition/network aggregate bucket keyed by cohort signature — not a direct tenant-row listing. |
| 76 | `src/lib/reminders/reminderEnqueue.server.ts` | 118 | `(top-level or unscoped)` | `fi_reminder_jobs` | insert/upsert safe | `rows` built with `tenant_id` per job enqueue path. |
| 77 | `src/lib/reminders/reminderEnqueue.server.ts` | 173 | `(top-level or unscoped)` | `fi_reminder_jobs` | insert/upsert safe | `rows` built with `tenant_id` per job enqueue path. |
| 78 | `src/lib/reminders/reminderEnqueue.server.ts` | 232 | `(top-level or unscoped)` | `fi_reminder_jobs` | insert/upsert safe | `rows` built with `tenant_id` per job enqueue path. |
| 79 | `src/lib/reminders/reminderJobs.server.ts` | 467 | `(top-level or unscoped)` | `fi_persons` | safe by prior ownership check | `personIdsNeeded` populated from tenant-scoped `fi_crm_leads` and reminder job rows for that tenant batch. |
| 80 | `src/lib/reminders/reminderProcessor.server.ts` | 219 | `processReminderJobsOnce` | `fi_reminder_jobs` | tenant-global/tooling | Worker dequeue lists pending jobs across tenants by design; per-job `tenant_id` is carried on the row for downstream tenant-scoped work. |
| 81 | `src/lib/revenueOs/fiPaymentRemindersCron.server.ts` | 48 | `(top-level or unscoped)` | `fi_invoices` | tenant-global/tooling | Cron-style sweep over invoices across tenants; must be restricted to trusted scheduler/cron identity (not a user-facing list API). |
| 82 | `src/lib/revenueOs/publicPaymentRequestLoaders.server.ts` | 36 | `loadPublicPaymentRequestView` | `fi_payment_requests` | false positive | Public payment view is scoped by `public_token`, not `tenant_id` on the chain. |
| 83 | `src/lib/revenueOs/revenueInvoiceMutations.server.ts` | 120 | `(top-level or unscoped)` | `fi_invoices` | insert/upsert safe | Invoice insert includes tenant from revenue mutation context. |
| 84 | `src/lib/staff/staff.server.ts` | 238 | `insertFiStaff` | `fi_staff` | insert/upsert safe | `payload` includes `tenant_id` for staff insert; snippet does not expand object literal. |
| 85 | `src/lib/staffImport/iiohrHrStaffImportRunner.ts` | 342 | `insertFiStaffRow` | `fi_staff` | insert/upsert safe | `payload` includes `tenant_id` for staff insert; snippet does not expand object literal. |
| 86 | `src/lib/staffPin/staffPinSession.server.ts` | 133 | `endStaffPinClinicSession` | `fi_staff_pin_sessions` | false positive | Row scope is the unguessable `session_token` (capability URL), analogous to public payment tokens. |
| 87 | `src/lib/staffPin/staffPinSession.server.ts` | 47 | `loadActiveSessionRow` | `fi_staff_pin_sessions` | false positive | Row scope is the unguessable `session_token` (capability URL), analogous to public payment tokens. |
| 88 | `src/lib/taxLocalisation/taxLocalisationSettings.server.ts` | 149 | `(top-level or unscoped)` | `fi_tax_localisation_settings` | insert/upsert safe | `rowPayload` includes `tenant_id` / clinic scope from `upsertTaxLocalisationDocument` args. |

---

## `true dangerous` and `needs service-role wrapper`

- **true dangerous (0 rows):** No DANGEROUS row was promoted here as an unconditional “ship blocker” without route/auth context. The closest **policy** risks are **system console** listings and **cron sweeps** (see **tenant-global/tooling**) — those become dangerous if the surrounding **authentication** or **deployment exposure** is wrong, not because the SQL lacks `tenant_id` alone.

- **needs service-role wrapper (0 rows):** Optional future hygiene (e.g. centralise `fi_event_links` access behind one module) — not required for this triage list.

---

*Generated by `tools/build-dangerous-review.mjs` from `tools/dangerous-rows.parsed.json`. Re-run after regenerating the CSV: `node tools/extract-dangerous-audit-rows.mjs && node tools/build-dangerous-review.mjs`.*
