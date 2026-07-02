# FI-UX-REBUILD D1B — Workspace Shell Validation

**Date:** 2026-07-02  
**Demo tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a` (Evolved Hair Restoration Perth)  
**Rollout:** `FI_WORKSPACE_SHELL_TENANT_IDS` — demo tenant only (default OFF elsewhere)

## Enable (local)

Add to `.env.local` (server restart required):

```env
FI_WORKSPACE_SHELL_TENANT_IDS=c2615b95-b707-4485-aa5f-be8f78ec868a
# Today surface recommended for item 2:
FI_TODAY_SURFACE_TENANT_IDS=c2615b95-b707-4485-aa5f-be8f78ec868a
```

Automated suite:

```bash
FI_E2E_BASE_URL=http://localhost:3000 \
FI_E2E_TENANT_ID=c2615b95-b707-4485-aa5f-be8f78ec868a \
FI_E2E_PATIENT_ID=<patient-uuid> \
FI_E2E_LEAD_ID=<lead-uuid> \
FI_E2E_WORKSPACE_SHELL_VALIDATION=true \
FI_E2E_BROWSERS=chromium \
npx playwright test e2e/fi-ux-workspace-shell-validation.spec.ts
```

## Validation checklist

| # | Check | Expected | Automated |
|---|--------|----------|-----------|
| 1 | Demo tenant only | Other tenants: no `WorkspaceShellMount` | Env gate unit test |
| 2 | Today → patient/lead/appointment | `?workspace=` in URL, panel open, route unchanged | Partial (needs feed data + Today flag) |
| 3 | Deep links | Single + stacked `?workspace=` | Yes (with fixture UUIDs) |
| 4 | Escape / back / forward | Escape clears; back pops history entry | Yes |
| 5 | Flag OFF | Legacy slide-over providers render own panels | Manual / separate server run |
| 6 | Calendar | Full-page calendar; no workspace on load | Yes |
| 7 | Mobile | Panel uses full viewport width | Yes |
| 8 | Today broken links | See table below | Manual audit |
| 9 | D2 safeguards | Body scroll lock, history-aware URL sync | Implemented |

## Today feed — workspace vs full-page navigation

`WorkspaceFeedLink` opens a panel only when `inferWorkspaceFromHref()` matches. All other hrefs navigate normally (by design until D2/D3).

| Source | Example href | Workspace? | Notes |
|--------|--------------|------------|-------|
| Reception card (named patient) | `/fi-admin/{tenant}/patients/{id}` | Yes | |
| Reception card (named lead) | `/fi-admin/{tenant}/crm/leads/{id}` | Yes | |
| Reception card (no id) | `/fi-admin/{tenant}/reception` | No | Module hub — expected |
| Stale lead | `/fi-admin/{tenant}/crm/leads/{id}` | Yes | |
| CRM task | `/fi-admin/{tenant}/crm/leads/{id}` | Yes | |
| Reminder | `/fi-admin/{tenant}/reminders/{id}` (typical) | No | No D1 reminder workspace |
| Aggregate: surgery | `/fi-admin/{tenant}/surgery-os` | No | Module hub |
| Aggregate: financial | `/fi-admin/{tenant}/financial/dashboard` | No | Module hub |
| Aggregate: calendar | `/fi-admin/{tenant}/calendar` | No | Protected full route |
| Aggregate: operations | `/fi-admin/{tenant}/operations` | No | Module hub |
| Aggregate: CRM index | `/fi-admin/{tenant}/crm` | No | List route |

**D2 follow-up:** add `workspaceRef` on `TodayFeedItem` for appointment/reminder rows where loaders already have entity ids; wire `pushWorkspace` for in-panel linked-entity clicks.

## Safeguards added before D2

1. **History-aware URL sync** — `router.push` on open/push; `router.back` on stack pop; `router.replace` on close-all (enables browser back/forward).
2. **Body scroll lock** while any workspace is open (matches mobile drawer behavior).
3. **Broader operator session** — `resolveWorkspaceShellOperatorSession` (CRM, bookings, or clinic-floor) so the shell mounts for portal operators, not only PatientOS layout sessions.
4. **Legacy bridge** — route-level slide-over providers skip rendering their panel when `WorkspaceShellProvider` is active (no double panels).
5. **Calendar freeze** — no changes under `lib/calendar/**` or calendar components; validation confirms calendar loads without workspace chrome.
6. **Authenticated panel loads** — patient/lead bundles require CRM session (`loadPatientSlideOverBundleAction`); unauthenticated Playwright runs will not see panels even when the flag is on.

## D1B validation run (2026-07-02)

| Check | Result | Notes |
|-------|--------|-------|
| Env enabled demo tenant only | Done | `.env.local`: `FI_WORKSPACE_SHELL_TENANT_IDS=c2615b95-...` |
| Today surface UUID allowlist | Fixed | Added UUID alongside `evolved-hair` slug |
| Deep link / Escape / back | Blocked w/o auth | Playwright without `FI_E2E_DEMO_ADMIN_*` — shell not mounted for anonymous dev sessions |
| Calendar unchanged | Pass | Automated |
| Mobile width | Blocked w/o auth | Same as above |
| Session resolver fix | Implemented | `resolveWorkspaceShellOperatorSession.server.ts` |

Re-run with demo admin credentials:

```bash
FI_E2E_DEMO_ADMIN_EMAIL=... FI_E2E_DEMO_ADMIN_PASSWORD=... \
FI_E2E_WORKSPACE_SHELL_VALIDATION=true \
npx playwright test e2e/fi-ux-workspace-shell-validation.spec.ts --project=chromium-authenticated
```

## Flag OFF regression

Start server **without** `FI_WORKSPACE_SHELL_TENANT_IDS` for the demo tenant, then:

- `/fi-admin/{tenant}/patients` — slide-over from list still works via `PatientSlideOverProvider`
- `/fi-admin/{tenant}/crm` — lead slide-over unchanged
- Calendar and appointments pages — existing providers only

## Known limitations (acceptable for D1)

- Stacked deep link shows **top panel only** (stack state preserved in URL; UI back bar when depth > 1 is not yet in slide-over panels).
- `popWorkspace` after direct deep link uses `replace` (no history) when stack depth is 1.
- Global search (⌘K) still navigates via href — D2 unified palette will open workspaces.
