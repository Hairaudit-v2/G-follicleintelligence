-- Seed Perth clinic rooms for Evolved Hair Restoration Perth when the clinic exists.

do $$
declare
  v_tenant_id uuid;
  v_clinic_id uuid;
  v_now timestamptz := now();
begin
  select id into v_tenant_id
  from fi_tenants
  where slug = 'evolved'
  limit 1;

  if v_tenant_id is null then
    return;
  end if;

  select id into v_clinic_id
  from fi_clinics
  where tenant_id = v_tenant_id
    and (
      lower(display_name) = lower('Evolved Hair Restoration Perth')
      or (
        lower(display_name) like '%perth%'
        and (lower(display_name) like '%evolved%' or lower(display_name) like '%restoration%')
      )
    )
  order by case when lower(display_name) = lower('Evolved Hair Restoration Perth') then 0 else 1 end
  limit 1;

  if v_clinic_id is null then
    select id into v_clinic_id
    from fi_clinics
    where tenant_id = v_tenant_id
      and lower(display_name) like '%perth%'
    limit 1;
  end if;

  if v_clinic_id is null then
    return;
  end if;

  insert into fi_clinic_rooms (
    tenant_id, clinic_id, room_code, display_name, physical_room_key, room_type, capabilities, sort_order, created_at, updated_at
  )
  values
    (v_tenant_id, v_clinic_id, 'cons_1', 'Consult Room 1', 'perth_phys_cons_1', 'consult', array['consultation']::text[], 10, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'cons_2', 'Consult Room 2', 'perth_phys_cons_2', 'consult', array['consultation', 'patient']::text[], 20, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'prp_1', 'PRP Room 1', 'perth_phys_prp_1', 'prp', array['prp', 'exosomes', 'prf']::text[], 30, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'prp_2', 'PRP Room 2', 'perth_phys_surgery_2', 'prp', array['prp', 'exosomes', 'prf']::text[], 40, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'surgery_1', 'Surgery 1', 'perth_phys_surgery_1', 'surgery', array['surgery']::text[], 50, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'surgery_2', 'Surgery 2', 'perth_phys_surgery_2', 'surgery', array['surgery', 'prp', 'exosomes']::text[], 60, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'patient_room_1', 'Patient Room 1', 'perth_phys_patient_1', 'patient', array['patient', 'follow_up']::text[], 70, v_now, v_now),
    (v_tenant_id, v_clinic_id, 'patient_room_2', 'Patient Room 2', 'perth_phys_cons_2', 'patient', array['patient', 'follow_up']::text[], 80, v_now, v_now)
  on conflict (tenant_id, clinic_id, room_code) do update
  set
    display_name = excluded.display_name,
    physical_room_key = excluded.physical_room_key,
    room_type = excluded.room_type,
    capabilities = excluded.capabilities,
    sort_order = excluded.sort_order,
    updated_at = v_now;
end $$;
