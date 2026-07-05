# FI-BRANDING-SYSTEM-1C

Status: FIXED BELOW UI / PENDING DEPLOY + BROWSER CONFIRMATION

Commit:
2e4d47c1

Confirmed:

- fi_tenant_settings save works
- tenant colours/name persist
- permissions are correct
- tenant-branding bucket now exists
- upload pipeline passes via smoke script (`npm run smoke:branding`)
- uploaded logo metadata persists
- signed logo URL resolves
- uploaded logo wins over legacy logo
- remove clears uploaded metadata and falls back correctly
- visible errors/debug logging added

Pending:

- deploy bodySizeLimit fix
- in-browser confirmation as platform admin, clinic_admin, and member sessions
  (debug panel + `[fi-branding-debug]` server logs will show permission result,
  payload, and save outcome for each attempt)

Root causes identified:

- `tenant-branding` storage bucket did not exist before 2026-07-05 04:51 UTC —
  all earlier uploads failed at the bucket layer.
- Next server action transport limit (1MB default) rejected 1–2MB logos before
  the action ran; the UI swallowed the thrown error (silent no-op). Fixed with
  `experimental.serverActions.bodySizeLimit: "4mb"` + try/catch error surfacing.
