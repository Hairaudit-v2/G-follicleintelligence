
-- ============================================================================
-- Patch 4: Legacy Clinical Table RLS Hardening
-- Scope   : 20250220-era clinical tables lacking Row Level Security policies
-- Strategy:
--   Group A — Enable RLS + tenant-scoped SELECT for authenticated
--             (tables with tenant_id containing clinical/business data)
--   Group B — Enable RLS + case-scoped SELECT for authenticated
--             (tables without tenant_id, linked via fi_cases.case_id)
--   Group C — Enable RLS, NO permissive policies (default deny)
--             (machine/queue/cross-tenant tables; service_role bypasses RLS)
--   Group D — RLS already enabled but SELECT policy absent — add it
--
-- All INSERT/UPDATE/DELETE operations remain service_role-only (bypass RLS).
-- No existing policies are removed. No app logic is changed.
-- ============================================================================


-- ===========================================================================
-- GROUP A: Enable RLS + tenant-scoped SELECT for authenticated users
-- Pattern mirrors existing fi_cases, fi_patients, fi_clinical_notes, etc.
-- ===========================================================================

-- fi_audits
-- Clinical audit trail records. Contains reviewer decisions + case references.
ALTER TABLE public.fi_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_audits_select_tenant_member
  ON public.fi_audits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_audits.tenant_id
    )
  );

-- fi_uploads
-- Patient file uploads (filename, storage_path, mime_type). High-PII attachment table.
ALTER TABLE public.fi_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_uploads_select_tenant_member
  ON public.fi_uploads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_uploads.tenant_id
    )
  );

-- fi_blood_signals  (legacy 20250220 signal table)
-- Raw blood test signal payloads. Clinical PII.
ALTER TABLE public.fi_blood_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_blood_signals_select_tenant_member
  ON public.fi_blood_signals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_blood_signals.tenant_id
    )
  );

-- fi_image_signals  (legacy 20250220 signal table)
-- Raw image analysis signal payloads. Clinical PII.
ALTER TABLE public.fi_image_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_image_signals_select_tenant_member
  ON public.fi_image_signals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_image_signals.tenant_id
    )
  );

-- fi_signals_blood  (canonical signal table, successor to fi_blood_signals)
-- Blood analysis signal payloads. Clinical PII.
ALTER TABLE public.fi_signals_blood ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_signals_blood_select_tenant_member
  ON public.fi_signals_blood
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_signals_blood.tenant_id
    )
  );

-- fi_signals_image  (canonical signal table, successor to fi_image_signals)
-- Image analysis signal payloads. Clinical PII.
ALTER TABLE public.fi_signals_image ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_signals_image_select_tenant_member
  ON public.fi_signals_image
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_signals_image.tenant_id
    )
  );

-- fi_scorecards
-- AI-generated clinical scorecards (domain_scores, overall_score, risk_tier, explainability).
-- Clinical intelligence output. Highly sensitive.
ALTER TABLE public.fi_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_scorecards_select_tenant_member
  ON public.fi_scorecards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_scorecards.tenant_id
    )
  );

-- fi_reports
-- Generated clinical reports (report_json, storage_path, storage_url).
-- Contains compiled patient clinical output. Highly sensitive.
ALTER TABLE public.fi_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_reports_select_tenant_member
  ON public.fi_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_reports.tenant_id
    )
  );

-- fi_partners
-- Tenant business partner configuration (reference_code, slug, organisation_id).
ALTER TABLE public.fi_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_partners_select_tenant_member
  ON public.fi_partners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_partners.tenant_id
    )
  );


-- ===========================================================================
-- GROUP B: Enable RLS + case-scoped SELECT for authenticated users
-- These tables have no direct tenant_id; tenant is resolved via fi_cases.
-- ===========================================================================

-- fi_referrals
-- Partner referral records linked to fi_cases via case_id (NOT NULL).
-- No direct tenant_id column; tenant derived from fi_cases.tenant_id.
ALTER TABLE public.fi_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_referrals_select_case_tenant_member
  ON public.fi_referrals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_cases c
      JOIN public.fi_users u ON u.tenant_id = c.tenant_id
      WHERE c.id = fi_referrals.case_id
        AND u.auth_user_id = auth.uid()
    )
  );


-- ===========================================================================
-- GROUP C: Machine/internal tables — Enable RLS, NO permissive policies
-- With RLS on and zero permissive policies, anon and authenticated are denied.
-- service_role has BYPASSRLS and retains full unrestricted access.
-- A comment is added to each table documenting the intentional restriction.
-- ===========================================================================

-- fi_model_runs
-- Internal ML job queue (status, stage, attempts, locked_at, last_error).
-- Not safe for direct client reads. Managed entirely by server-side workers.
COMMENT ON TABLE public.fi_model_runs IS
  'SERVICE_ROLE ONLY. Internal ML model job queue. '
  'RLS is intentionally enabled with no permissive policies — anon and authenticated are denied by default. '
  'All access must use the Supabase service_role key via server-side code.';

ALTER TABLE public.fi_model_runs ENABLE ROW LEVEL SECURITY;

-- fi_jobs
-- Internal background job queue (status, stage, attempts, locked_at, last_error).
-- Managed entirely by server-side workers.
COMMENT ON TABLE public.fi_jobs IS
  'SERVICE_ROLE ONLY. Internal background job queue. '
  'RLS is intentionally enabled with no permissive policies — anon and authenticated are denied by default. '
  'All access must use the Supabase service_role key via server-side code.';

ALTER TABLE public.fi_jobs ENABLE ROW LEVEL SECURITY;

-- fi_events
-- Integration event ingestion log (payload_json from external systems).
-- Contains raw external payloads that must not be exposed to client roles.
COMMENT ON TABLE public.fi_events IS
  'SERVICE_ROLE ONLY. Integration event ingestion log containing raw external payload_json. '
  'RLS is intentionally enabled with no permissive policies — anon and authenticated are denied by default. '
  'All access must use the Supabase service_role key via server-side code.';

ALTER TABLE public.fi_events ENABLE ROW LEVEL SECURITY;

-- fi_event_links
-- Event-to-entity routing junction table.
-- Uses nullable cross-entity IDs (global_case_id, fi_case_id, global_patient_id, patient_id, clinic_id).
-- No reliable single tenant scope can be enforced safely given nullable links.
COMMENT ON TABLE public.fi_event_links IS
  'SERVICE_ROLE ONLY. Event routing junction table with nullable cross-entity ID columns. '
  'A reliable tenant-scope policy cannot be constructed safely due to nullable fi_case_id. '
  'RLS is intentionally enabled with no permissive policies — anon and authenticated are denied by default. '
  'All access must use the Supabase service_role key via server-side code.';

ALTER TABLE public.fi_event_links ENABLE ROW LEVEL SECURITY;

-- fi_global_cases
-- Cross-tenant case index (source_system, source_case_id, metadata_json).
-- Even though it carries tenant_id, it aggregates cross-tenant case linkages.
-- Permissive SELECT would risk cross-tenant case enumeration.
COMMENT ON TABLE public.fi_global_cases IS
  'SERVICE_ROLE ONLY. Cross-tenant case index. '
  'Permissive client SELECT would risk cross-tenant case enumeration. '
  'RLS is intentionally enabled with no permissive policies — anon and authenticated are denied by default. '
  'All access must use the Supabase service_role key via server-side code.';

ALTER TABLE public.fi_global_cases ENABLE ROW LEVEL SECURITY;

-- fi_global_patients
-- Cross-tenant patient index (source_system, source_patient_id, metadata_json).
-- Carries cross-tenant patient PII. Permissive SELECT risks cross-tenant leakage.
COMMENT ON TABLE public.fi_global_patients IS
  'SERVICE_ROLE ONLY. Cross-tenant patient index. '
  'Permissive client SELECT would risk cross-tenant patient PII leakage. '
  'RLS is intentionally enabled with no permissive policies — anon and authenticated are denied by default. '
  'All access must use the Supabase service_role key via server-side code.';

ALTER TABLE public.fi_global_patients ENABLE ROW LEVEL SECURITY;


-- ===========================================================================
-- GROUP D: RLS already enabled, SELECT policy absent — add explicit policy
-- fi_intakes had RLS turned on but zero policies, creating an implicit deny.
-- The implicit deny is the safest state but leaves intent undocumented.
-- Adding an explicit tenant-scoped SELECT documents the access model and
-- allows clinic staff to read patient intake records via the client.
-- ===========================================================================

-- fi_intakes
-- Patient intake forms (full_name, email, dob, sex — highest PII tier).
-- RLS was previously enabled with no policies (implicit deny for all client roles).
-- Explicit tenant-scoped SELECT added here to document the intended access model.
CREATE POLICY fi_intakes_select_tenant_member
  ON public.fi_intakes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fi_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.tenant_id = fi_intakes.tenant_id
    )
  );
