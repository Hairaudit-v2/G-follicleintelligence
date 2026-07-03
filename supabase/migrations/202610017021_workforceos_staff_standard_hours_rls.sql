-- WorkforceOS — fi_staff_standard_hours write RLS for workforce managers.

do $$
begin
  if to_regclass('public.fi_staff_standard_hours') is not null
     and to_regclass('public.fi_users') is not null then

    drop policy if exists fi_staff_standard_hours_insert_hr_manager
      on public.fi_staff_standard_hours;
    create policy fi_staff_standard_hours_insert_hr_manager
      on public.fi_staff_standard_hours for insert to authenticated
      with check (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_standard_hours.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
        and exists (
          select 1 from public.fi_staff s
          where s.id = fi_staff_standard_hours.staff_id
            and s.tenant_id = fi_staff_standard_hours.tenant_id
        )
        and (
          fi_staff_standard_hours.clinic_id is null
          or exists (
            select 1 from public.fi_clinics c
            where c.id = fi_staff_standard_hours.clinic_id
              and c.tenant_id = fi_staff_standard_hours.tenant_id
          )
        )
      );

    drop policy if exists fi_staff_standard_hours_update_hr_manager
      on public.fi_staff_standard_hours;
    create policy fi_staff_standard_hours_update_hr_manager
      on public.fi_staff_standard_hours for update to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_standard_hours.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      )
      with check (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_standard_hours.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
        and exists (
          select 1 from public.fi_staff s
          where s.id = fi_staff_standard_hours.staff_id
            and s.tenant_id = fi_staff_standard_hours.tenant_id
        )
        and (
          fi_staff_standard_hours.clinic_id is null
          or exists (
            select 1 from public.fi_clinics c
            where c.id = fi_staff_standard_hours.clinic_id
              and c.tenant_id = fi_staff_standard_hours.tenant_id
          )
        )
      );

    grant insert, update on public.fi_staff_standard_hours to authenticated;
  end if;
end $$;
