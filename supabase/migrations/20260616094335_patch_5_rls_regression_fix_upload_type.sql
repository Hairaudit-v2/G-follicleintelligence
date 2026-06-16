
-- Fix fi_uploads seed: 'photo' is not a valid type; use 'blood_pdf'
-- Allowed: blood_pdf | blood_csv | scalp_preop_front | scalp_sides_left |
--          scalp_sides_right | scalp_crown | donor_rear | postop_day0 | supporting_docs

CREATE OR REPLACE FUNCTION public.fi_rls_regression_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_tid_a      uuid := 'aa000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_tid_b      uuid := 'bb000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_auth_a     uuid := 'aa000002-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_auth_b     uuid := 'bb000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_uid_a      uuid := 'aa000003-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_uid_b      uuid := 'bb000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_case_a     uuid := 'aa000004-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_case_b     uuid := 'bb000004-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_partner_a  uuid := 'aa000005-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_partner_b  uuid := 'bb000005-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_run_a      uuid := 'aa000006-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_run_b      uuid := 'bb000006-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_report_a   uuid := 'aa000007-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_report_b   uuid := 'bb000007-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_gpt_a      uuid := 'aa000008-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_gpt_b      uuid := 'bb000008-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_gc_a       uuid := 'aa000009-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_gc_b       uuid := 'bb000009-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_ev_a       uuid := 'aa000010-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_ev_b       uuid := 'bb000010-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  v_tests      jsonb  := '[]'::jsonb;
  v_pass       int    := 0;
  v_fail       int    := 0;
  v_row        bigint;
BEGIN
  BEGIN
    -- ── SEED ──────────────────────────────────────────────────────────────
    INSERT INTO public.fi_tenants (id, name, slug) VALUES
      (v_tid_a, 'RLS-Regression-Tenant-A', 'rls-reg-a'),
      (v_tid_b, 'RLS-Regression-Tenant-B', 'rls-reg-b');

    INSERT INTO public.fi_users (id, tenant_id, auth_user_id, email) VALUES
      (v_uid_a, v_tid_a, v_auth_a, 'rls-test-a@test.internal'),
      (v_uid_b, v_tid_b, v_auth_b, 'rls-test-b@test.internal');

    INSERT INTO public.fi_partners (id, tenant_id, name, reference_code) VALUES
      (v_partner_a, v_tid_a, 'Test Partner A', 'RLS-REF-A'),
      (v_partner_b, v_tid_b, 'Test Partner B', 'RLS-REF-B');

    INSERT INTO public.fi_cases (id, tenant_id, status) VALUES
      (v_case_a, v_tid_a, 'draft'),
      (v_case_b, v_tid_b, 'draft');

    INSERT INTO public.fi_model_runs (id, tenant_id, case_id, status, attempts) VALUES
      (v_run_a, v_tid_a, v_case_a, 'complete', 1),
      (v_run_b, v_tid_b, v_case_b, 'complete', 1);

    INSERT INTO public.fi_reports (id, tenant_id, case_id, model_run_id, version, report_json, status) VALUES
      (v_report_a, v_tid_a, v_case_a, v_run_a, 1, '{"rls_test":true}', 'draft'),
      (v_report_b, v_tid_b, v_case_b, v_run_b, 1, '{"rls_test":true}', 'draft');

    INSERT INTO public.fi_scorecards (tenant_id, case_id, model_run_id, domain_scores) VALUES
      (v_tid_a, v_case_a, v_run_a, '{"rls_test":true}'),
      (v_tid_b, v_case_b, v_run_b, '{"rls_test":true}');

    INSERT INTO public.fi_audits (tenant_id, case_id, report_id, status) VALUES
      (v_tid_a, v_case_a, v_report_a, 'approved'),
      (v_tid_b, v_case_b, v_report_b, 'approved');

    -- type must be one of the clinical upload types
    INSERT INTO public.fi_uploads (tenant_id, case_id, type, filename, storage_path) VALUES
      (v_tid_a, v_case_a, 'blood_pdf', 'rls-test-a.pdf', 'rls-test/a/blood.pdf'),
      (v_tid_b, v_case_b, 'blood_pdf', 'rls-test-b.pdf', 'rls-test/b/blood.pdf');

    INSERT INTO public.fi_blood_signals (tenant_id, case_id, payload) VALUES
      (v_tid_a, v_case_a, '{"rls_test":true}'),
      (v_tid_b, v_case_b, '{"rls_test":true}');

    INSERT INTO public.fi_image_signals (tenant_id, case_id, payload) VALUES
      (v_tid_a, v_case_a, '{"rls_test":true}'),
      (v_tid_b, v_case_b, '{"rls_test":true}');

    INSERT INTO public.fi_signals_blood (tenant_id, case_id, payload) VALUES
      (v_tid_a, v_case_a, '{"rls_test":true}'),
      (v_tid_b, v_case_b, '{"rls_test":true}');

    INSERT INTO public.fi_signals_image (tenant_id, case_id, payload) VALUES
      (v_tid_a, v_case_a, '{"rls_test":true}'),
      (v_tid_b, v_case_b, '{"rls_test":true}');

    INSERT INTO public.fi_intakes (tenant_id, case_id, full_name, email, dob, sex) VALUES
      (v_tid_a, v_case_a, 'RLS Test Patient A', 'rls-pt-a@test.internal', '1990-01-01', 'M'),
      (v_tid_b, v_case_b, 'RLS Test Patient B', 'rls-pt-b@test.internal', '1990-01-01', 'F');

    INSERT INTO public.fi_referrals (partner_id, case_id, referral_code) VALUES
      (v_partner_a, v_case_a, 'RLS-TEST-CODE-A'),
      (v_partner_b, v_case_b, 'RLS-TEST-CODE-B');

    INSERT INTO public.fi_jobs (tenant_id, case_id, status, attempts) VALUES
      (v_tid_a, v_case_a, 'queued', 0),
      (v_tid_b, v_case_b, 'queued', 0);

    INSERT INTO public.fi_events (
      id, tenant_id, event_type, source_system, source_event_id,
      occurred_at, payload_json, status, created_at, updated_at
    ) VALUES
      (v_ev_a, v_tid_a, 'rls.test', 'rls-test', 'ev-a', now(), '{}', 'received', now(), now()),
      (v_ev_b, v_tid_b, 'rls.test', 'rls-test', 'ev-b', now(), '{}', 'received', now(), now());

    INSERT INTO public.fi_global_patients
      (id, tenant_id, source_system, source_patient_id, metadata_json, created_at, updated_at)
    VALUES
      (v_gpt_a, v_tid_a, 'rls-test', 'gp-a', '{}', now(), now()),
      (v_gpt_b, v_tid_b, 'rls-test', 'gp-b', '{}', now(), now());

    INSERT INTO public.fi_global_cases
      (id, tenant_id, source_system, source_case_id, status, metadata_json, created_at, updated_at)
    VALUES
      (v_gc_a, v_tid_a, 'rls-test', 'gc-a', 'active', '{}', now(), now()),
      (v_gc_b, v_tid_b, 'rls-test', 'gc-b', 'active', '{}', now(), now());

    INSERT INTO public.fi_event_links (event_id, created_at) VALUES
      (v_ev_a, now()),
      (v_ev_b, now());

    INSERT INTO public.fi_timeline_events (tenant_id, case_id, event_kind, occurred_at, created_at) VALUES
      (v_tid_a, v_case_a, 'rls.test', now(), now()),
      (v_tid_b, v_case_b, 'rls.test', now(), now());

    -- ── ASSERTIONS ────────────────────────────────────────────────────────
    -- GROUP C: deny-all
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    EXECUTE 'SELECT count(*) FROM public.fi_model_runs'      INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T01','fi_model_runs deny-all',       0, v_row);
    EXECUTE 'SELECT count(*) FROM public.fi_jobs'            INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T02','fi_jobs deny-all',             0, v_row);
    EXECUTE 'SELECT count(*) FROM public.fi_events'          INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T03','fi_events deny-all',           0, v_row);
    EXECUTE 'SELECT count(*) FROM public.fi_event_links'     INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T04','fi_event_links deny-all',      0, v_row);
    EXECUTE 'SELECT count(*) FROM public.fi_global_cases'    INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T05','fi_global_cases deny-all',     0, v_row);
    EXECUTE 'SELECT count(*) FROM public.fi_global_patients' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T06','fi_global_patients deny-all',  0, v_row);

    EXECUTE 'RESET ROLE';

    -- GROUP A + D: tenant-scoped SELECT
    -- fi_uploads
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_uploads' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T07a','fi_uploads: userA sees own tenant',       1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_uploads WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T07b','fi_uploads: userA blocked from tenantB',  0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_uploads' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T07c','fi_uploads: userB sees own tenant',       1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_audits
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_audits' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T08a','fi_audits: userA sees own tenant',        1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_audits WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T08b','fi_audits: userA blocked from tenantB',   0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_audits' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T08c','fi_audits: userB sees own tenant',        1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_blood_signals
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_blood_signals' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T09a','fi_blood_signals: userA sees own tenant', 1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_blood_signals WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T09b','fi_blood_signals: userA blocked tenantB', 0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_blood_signals' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T09c','fi_blood_signals: userB sees own tenant', 1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_image_signals
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_image_signals' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T10a','fi_image_signals: userA sees own tenant', 1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_image_signals WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T10b','fi_image_signals: userA blocked tenantB', 0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_image_signals' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T10c','fi_image_signals: userB sees own tenant', 1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_signals_blood
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_signals_blood' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T11a','fi_signals_blood: userA sees own tenant', 1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_signals_blood WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T11b','fi_signals_blood: userA blocked tenantB', 0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_signals_blood' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T11c','fi_signals_blood: userB sees own tenant', 1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_signals_image
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_signals_image' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T12a','fi_signals_image: userA sees own tenant', 1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_signals_image WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T12b','fi_signals_image: userA blocked tenantB', 0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_signals_image' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T12c','fi_signals_image: userB sees own tenant', 1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_scorecards
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_scorecards' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T13a','fi_scorecards: userA sees own tenant',    1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_scorecards WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T13b','fi_scorecards: userA blocked tenantB',    0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_scorecards' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T13c','fi_scorecards: userB sees own tenant',    1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_reports
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_reports' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T14a','fi_reports: userA sees own tenant',       1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_reports WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T14b','fi_reports: userA blocked tenantB',       0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_reports' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T14c','fi_reports: userB sees own tenant',       1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_partners
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_partners' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T15a','fi_partners: userA sees own tenant',      1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_partners WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T15b','fi_partners: userA blocked tenantB',      0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_partners' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T15c','fi_partners: userB sees own tenant',      1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_intakes (Group D — highest PII)
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_intakes' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T16a','fi_intakes: userA sees own tenant PII',       1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_intakes WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T16b','fi_intakes: userA blocked from tenantB PII', 0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_intakes' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T16c','fi_intakes: userB sees own tenant PII',       1, v_row);
    EXECUTE 'RESET ROLE';

    -- GROUP B: fi_referrals — case-scoped
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_referrals' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T17a','fi_referrals: userA sees own case',               1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_referrals WHERE case_id=%L',v_case_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T17b','fi_referrals: userA blocked from tenantB case',   0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_referrals' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T17c','fi_referrals: userB sees own case',               1, v_row);
    EXECUTE 'RESET ROLE';

    -- fi_timeline_events (pre-existing — regression check)
    PERFORM set_config('request.jwt.claim.sub', v_auth_a::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_timeline_events' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T18a','fi_timeline_events: userA sees own tenant',  1, v_row);
    EXECUTE format('SELECT count(*) FROM public.fi_timeline_events WHERE tenant_id=%L',v_tid_b) INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T18b','fi_timeline_events: userA blocked tenantB',  0, v_row);
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_auth_b::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT count(*) FROM public.fi_timeline_events' INTO v_row;
    v_tests := v_tests || fi_rls_build_result('T18c','fi_timeline_events: userB sees own tenant',  1, v_row);
    EXECUTE 'RESET ROLE';

    RAISE EXCEPTION 'RLS_TEST_ROLLBACK_SENTINEL';

  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'RLS_TEST_ROLLBACK_SENTINEL' THEN RAISE; END IF;
  END;

  SELECT
    COUNT(*) FILTER (WHERE (t->>'passed')::boolean),
    COUNT(*) FILTER (WHERE NOT (t->>'passed')::boolean)
  INTO v_pass, v_fail
  FROM jsonb_array_elements(v_tests) AS t;

  RETURN jsonb_build_object(
    'passed', v_pass,
    'failed', v_fail,
    'total',  v_pass + v_fail,
    'tests',  v_tests
  );
END;
$fn$;
