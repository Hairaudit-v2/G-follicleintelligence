-- Hamilton–Norwood / Ludwig / hairline pattern / primary concern on structured clinical summary.

alter table fi_patient_clinical_details
  add column if not exists norwood_scale text,
  add column if not exists ludwig_scale text,
  add column if not exists hairline_pattern text,
  add column if not exists primary_concern text;

comment on column fi_patient_clinical_details.norwood_scale is 'Hamilton–Norwood stage (roman-style code, e.g. IIIa, IV, Va). Nullable.';
comment on column fi_patient_clinical_details.ludwig_scale is 'Ludwig classification for female-pattern loss (I–III). Nullable.';
comment on column fi_patient_clinical_details.hairline_pattern is 'Observed hairline / loss distribution pattern (controlled vocabulary). Nullable.';
comment on column fi_patient_clinical_details.primary_concern is 'Primary patient-stated clinical concern (bounded free text). Nullable.';

alter table fi_patient_clinical_details drop constraint if exists fi_patient_clinical_details_norwood_scale_len;
alter table fi_patient_clinical_details drop constraint if exists fi_patient_clinical_details_ludwig_scale_chk;
alter table fi_patient_clinical_details drop constraint if exists fi_patient_clinical_details_hairline_pattern_chk;
alter table fi_patient_clinical_details drop constraint if exists fi_patient_clinical_details_primary_concern_len;

alter table fi_patient_clinical_details
  add constraint fi_patient_clinical_details_norwood_scale_len check (
    norwood_scale is null or char_length(norwood_scale) <= 16
  ),
  add constraint fi_patient_clinical_details_ludwig_scale_chk check (
    ludwig_scale is null or ludwig_scale in ('I', 'II', 'III')
  ),
  add constraint fi_patient_clinical_details_hairline_pattern_chk check (
    hairline_pattern is null
    or hairline_pattern in (
      'receding',
      'diffuse',
      'mature',
      'stable',
      'temporal_recession',
      'vertex_thinning',
      'unknown'
    )
  ),
  add constraint fi_patient_clinical_details_primary_concern_len check (
    primary_concern is null or char_length(primary_concern) <= 500
  );

create index if not exists idx_fi_patient_clinical_details_tenant_norwood
  on fi_patient_clinical_details (tenant_id, norwood_scale)
  where norwood_scale is not null;

create index if not exists idx_fi_patient_clinical_details_tenant_ludwig
  on fi_patient_clinical_details (tenant_id, ludwig_scale)
  where ludwig_scale is not null;
