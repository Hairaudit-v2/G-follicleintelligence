-- CalendarOS performance — overlap query indexes for month/week/day calendar loaders (GC-5/GC-6).

create index if not exists idx_fi_calendar_events_tenant_start_end
  on public.fi_calendar_events (tenant_id, start_time, end_time);

create index if not exists idx_fi_staff_calendar_links_tenant_provider_calendar_status
  on public.fi_staff_calendar_links (tenant_id, provider, calendar_id, status);
