-- Multiple logical rooms may share one physical_room_key (overlap prevention across labels).
-- The previous unique index blocked valid layouts (e.g. PRP Room 2 + Surgery 2 sharing one theatre).

drop index if exists idx_fi_clinic_rooms_tenant_clinic_physical_key;

create index if not exists idx_fi_clinic_rooms_tenant_clinic_physical_key
  on fi_clinic_rooms (tenant_id, clinic_id, physical_room_key);
