-- Network subject foundation — local smoke checks (no backfill, no app code).
-- Prerequisites: migrations through 20260821120002 applied (e.g. `npx supabase db reset --yes`).
-- Run via: npm run smoke:network-subjects:only   (or full reset + smoke: npm run smoke:network-subjects)
-- Implementation: scripts/run-supabase-sql-docker.mjs pipes this file to `docker exec … psql` (multi-statement).
-- Fixture rows are deleted at the end.

-- ---------- fixtures (deterministic UUIDs) ----------
INSERT INTO public.fi_tenants (id, name, slug)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Smoke NS A', 'ns-smoke-foundation-a'),
  ('22222222-2222-2222-2222-222222222222', 'Smoke NS B', 'ns-smoke-foundation-b');

INSERT INTO public.fi_persons (id, tenant_id)
VALUES
  ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222'),
  ('b3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('b4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');

INSERT INTO public.fi_patients (id, tenant_id, person_id)
VALUES
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222'),
  ('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333'),
  ('c4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'b4444444-4444-4444-4444-444444444444');

INSERT INTO public.fi_users (id, tenant_id, auth_user_id, email)
VALUES (
  'd1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ns-smoke-user@example.local'
);

INSERT INTO public.fi_network_subjects (id, display_label)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'subject-a'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'subject-b'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'orphan-no-membership'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'subject-dup-active'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'subject-coexist-1'),
  ('12121212-1212-1212-1212-121212121212', 'subject-coexist-2'),
  ('13131313-1313-1313-1313-131313131313', 'subject-coexist-3');

-- Tenant A patient A ↔ subject A (active); tenant B patient B ↔ subject B (active)
INSERT INTO public.fi_network_subject_members (
  network_subject_id, tenant_id, patient_id, membership_status, confidence
)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'active', 0.5),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'active', null);

-- ---------- 2) matching tenant + patient succeeds (already inserted) ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.fi_network_subject_members m
    WHERE m.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
      AND m.patient_id = 'c1111111-1111-1111-1111-111111111111'::uuid
      AND m.membership_status = 'active'
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL (2): expected active membership for matching tenant/patient';
  END IF;
END $$;

-- ---------- 3) mismatched tenant_id + patient_id fails (trigger / check) ----------
DO $$
BEGIN
  INSERT INTO public.fi_network_subject_members (
    network_subject_id, tenant_id, patient_id, membership_status
  ) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222'::uuid,
    'c1111111-1111-1111-1111-111111111111'::uuid,
    'active'
  );
  RAISE EXCEPTION 'SMOKE FAIL (3): mismatched tenant/patient insert should have failed';
EXCEPTION
  WHEN sqlstate '23514' THEN
    NULL;
END $$;

-- ---------- 4) duplicate active membership same (tenant_id, patient_id) fails ----------
DO $$
BEGIN
  INSERT INTO public.fi_network_subject_members (
    network_subject_id, tenant_id, patient_id, membership_status
  ) VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'c1111111-1111-1111-1111-111111111111'::uuid,
    'active'
  );
  RAISE EXCEPTION 'SMOKE FAIL (4): second active membership for same tenant/patient should fail';
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END $$;

-- ---------- 5) superseded + revoked can coexist with one active ----------
INSERT INTO public.fi_network_subject_members (
  network_subject_id, tenant_id, patient_id, membership_status
)
VALUES
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'c3333333-3333-3333-3333-333333333333'::uuid,
    'active'
  ),
  (
    '12121212-1212-1212-1212-121212121212',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'c3333333-3333-3333-3333-333333333333'::uuid,
    'superseded'
  ),
  (
    '13131313-1313-1313-1313-131313131313',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'c3333333-3333-3333-3333-333333333333'::uuid,
    'revoked'
  );

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM public.fi_network_subject_members
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND patient_id = 'c3333333-3333-3333-3333-333333333333'::uuid;
  IF n <> 3 THEN
    RAISE EXCEPTION 'SMOKE FAIL (5): expected 3 membership rows (active + superseded + revoked), got %', n;
  END IF;
END $$;

-- ---------- 6) confidence outside 0..1 fails ----------
DO $$
BEGIN
  INSERT INTO public.fi_network_subject_members (
    network_subject_id, tenant_id, patient_id, membership_status, confidence
  ) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'c4444444-4444-4444-4444-444444444444'::uuid,
    'active',
    1.01
  );
  RAISE EXCEPTION 'SMOKE FAIL (6): invalid confidence should fail CHECK';
EXCEPTION
  WHEN check_violation THEN
    NULL;
END $$;

-- ---------- 7) Subject visibility matches tenant-membership policy (same predicate as RLS, auth sub fixed) ----------
-- Note: SET ROLE authenticated + policy subquery hits "permission denied for fi_users" locally because
-- `authenticated` lacks SELECT on `fi_users`; we assert the policy *predicate* as superuser with auth_user_id = fixture UUID.
DO $$
DECLARE
  v_auth uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  vis_b boolean;
  vis_c boolean;
  vis_d boolean;
  n int;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.fi_network_subjects s
    WHERE s.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.fi_network_subject_members m
        JOIN public.fi_users u ON u.tenant_id = m.tenant_id
        WHERE m.network_subject_id = s.id
          AND u.auth_user_id = v_auth
      )
  )
  INTO vis_b;

  SELECT EXISTS (
    SELECT 1
    FROM public.fi_network_subjects s
    WHERE s.id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.fi_network_subject_members m
        JOIN public.fi_users u ON u.tenant_id = m.tenant_id
        WHERE m.network_subject_id = s.id
          AND u.auth_user_id = v_auth
      )
  )
  INTO vis_c;

  SELECT EXISTS (
    SELECT 1
    FROM public.fi_network_subjects s
    WHERE s.id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.fi_network_subject_members m
        JOIN public.fi_users u ON u.tenant_id = m.tenant_id
        WHERE m.network_subject_id = s.id
          AND u.auth_user_id = v_auth
      )
  )
  INTO vis_d;

  SELECT count(*)::int
  INTO n
  FROM public.fi_network_subjects s
  WHERE EXISTS (
    SELECT 1
    FROM public.fi_network_subject_members m
    JOIN public.fi_users u ON u.tenant_id = m.tenant_id
    WHERE m.network_subject_id = s.id
      AND u.auth_user_id = v_auth
  );

  IF NOT vis_b THEN
    RAISE EXCEPTION 'SMOKE FAIL (7a): subject with membership in user tenant must be visible under policy predicate';
  END IF;
  IF vis_c THEN
    RAISE EXCEPTION 'SMOKE FAIL (7b): subject only linked via tenant B must not be visible';
  END IF;
  IF vis_d THEN
    RAISE EXCEPTION 'SMOKE FAIL (7c): orphan subject must not be visible';
  END IF;
  IF n < 1 THEN
    RAISE EXCEPTION 'SMOKE FAIL (7d): expected at least one visible subject, got %', n;
  END IF;
END $$;

-- ---------- 8) updated_at advances on UPDATE ----------
DO $$
DECLARE
  ts_before timestamptz;
  ts_after timestamptz;
BEGIN
  SELECT updated_at INTO STRICT ts_before
  FROM public.fi_network_subjects
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  PERFORM pg_sleep(0.05);

  UPDATE public.fi_network_subjects
  SET display_label = 'subject-a-updated'
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  SELECT updated_at INTO STRICT ts_after
  FROM public.fi_network_subjects
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

  IF ts_after <= ts_before THEN
    RAISE EXCEPTION 'SMOKE FAIL (8): updated_at did not advance (before %, after %)', ts_before, ts_after;
  END IF;
END $$;

-- ---------- cleanup (fixtures; order respects FKs) ----------
DELETE FROM public.fi_network_subject_members
WHERE network_subject_id IN (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  '12121212-1212-1212-1212-121212121212'::uuid,
  '13131313-1313-1313-1313-131313131313'::uuid
);

DELETE FROM public.fi_network_subjects
WHERE id IN (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  '12121212-1212-1212-1212-121212121212'::uuid,
  '13131313-1313-1313-1313-131313131313'::uuid
);

DELETE FROM public.fi_users WHERE id = 'd1111111-1111-1111-1111-111111111111'::uuid;

DELETE FROM public.fi_patients
WHERE id IN (
  'c1111111-1111-1111-1111-111111111111'::uuid,
  'c2222222-2222-2222-2222-222222222222'::uuid,
  'c3333333-3333-3333-3333-333333333333'::uuid,
  'c4444444-4444-4444-4444-444444444444'::uuid
);

DELETE FROM public.fi_persons
WHERE id IN (
  'b1111111-1111-1111-1111-111111111111'::uuid,
  'b2222222-2222-2222-2222-222222222222'::uuid,
  'b3333333-3333-3333-3333-333333333333'::uuid,
  'b4444444-4444-4444-4444-444444444444'::uuid
);

DELETE FROM public.fi_tenants
WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

SELECT 'SMOKE OK: fi_network_subjects foundation checks passed (fixtures removed)' AS result;
