# FI OS Stage 3.5 — Organisational intelligence layer

This stage adds **structured** workforce metadata (`fi_staff_position_types`), **feature templates** (`fi_staff_feature_templates`), and **tenant operating mode** catalog rows (`fi_tenant_operating_modes`), plus optional `fi_staff.position_type_id`.

## Behaviour guarantees

- Stage 2 per-staff `fi_staff_feature_access` overrides still win over templates and tenant-mode defaults.
- Stage 3 workspace profiles remain; explicit `staff_metadata.workspace_profile` still wins over position/template hints.
- Legacy `fi_staff.staff_role` substring heuristics remain as **fallback** when structured data is absent.
- Tenant operating mode defaults apply **only** when `fi_tenants.config_json.fi_os_operating_mode_key` is set to a known `fi_tenant_operating_modes.mode_key`.

## Stage 4 TODOs

- Route-level feature enforcement using effective access maps.
- Feature access audit trail (who toggled what, when).
- Tenant operating mode admin UI and safer rollout controls.
