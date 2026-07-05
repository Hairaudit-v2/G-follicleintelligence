# FI-BRANDING-SYSTEM-1C — COMPLETE

Commit:
2e4d47c1

Root cause:
Not tenant settings persistence. Settings saves were updating fi_tenant_settings
correctly. Logo upload failed because the private tenant-branding bucket did not
exist for earlier tests, and because Next server actions rejected 1–2 MB uploads
before the upload action executed due to the default 1 MB body limit. The UI
swallowed this as a silent revert.

Fix adds:

- serverActions.bodySizeLimit = 4 MB
- hardened branding upload/save/remove handlers
- visible UI errors
- debug logging via [fi-branding-debug]
- dev-only branding source panel
- end-to-end smoke script (`npm run smoke:branding`) proving storage object
  write, metadata persistence, signed URL resolution, logo priority,
  remove/fallback, and cleanup

Remaining:

- deploy fix
