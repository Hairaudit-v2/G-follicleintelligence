-- FI-TREATMENT-IMAGING-PROTOCOL-1 — standard scalp imaging for regenerative treatment bookings.

insert into
  fi_imaging_protocol_templates (tenant_id, slug, name, description, slots)
values
  (
    null,
    'treatment_scalp_standard',
    'Treatment scalp — standard series',
    'Five required scalp views for in-clinic PRP, mesotherapy, dutasteride mesotherapy, and exosome sessions.',
    $j${"slots":[
      {"slug":"front_hairline","label":"Frontal hairline","required":true,"slot_tier":"primary","suggested_region":"hairline","capture_guide":"front_hairline","instruction":"Face the camera directly. Include the full hairline from ear to ear at arm's length."},
      {"slug":"left_side","label":"Left side / temple","required":true,"slot_tier":"primary","suggested_region":"temple_left","capture_guide":"left_side","instruction":"Turn head slightly right to expose the left temporal and parietal zone."},
      {"slug":"right_side","label":"Right side / temple","required":true,"slot_tier":"primary","suggested_region":"temple_right","capture_guide":"right_side","instruction":"Turn head slightly left to expose the right temporal and parietal zone."},
      {"slug":"top","label":"Top / mid-scalp","required":true,"slot_tier":"primary","suggested_region":"midscalp","capture_guide":"top","instruction":"Capture a true overhead view of the midscalp."},
      {"slug":"crown","label":"Crown","required":true,"slot_tier":"primary","suggested_region":"crown","capture_guide":"crown","instruction":"Centre the crown / vertex in frame."},
      {"slug":"misc","label":"Misc clinical image","required":false,"slot_tier":"optional","suggested_region":"other","capture_guide":"front_close","instruction":"Optional additional clinical photo."}
    ]}$j$::jsonb
  )
on conflict (slug) where (tenant_id is null) do update
set
  name = excluded.name,
  description = excluded.description,
  slots = excluded.slots,
  updated_at = now();

comment on table fi_imaging_protocol_templates is
  'ImagingOS protocol templates including treatment_scalp_standard for regenerative in-clinic sessions.';
