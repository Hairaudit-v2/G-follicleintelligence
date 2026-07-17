# FI-UX-STRUCTURE-2C.1A — Proven navigation cleanup

## Executive verdict

**AMBER.** The discovery-bound safe subset is implemented and reversible. Remaining blockers from
FI-UX-STRUCTURE-2B and from this tranche's intentional non-scope prevent GREEN.

Base ownership commit: `5b042e07`.

## Exact changes

### Settings strip (`FiOsClinicSettingsNav`)

Before:

Configuration, Staff, Services, Rooms, Clinic setup, Templates, Tax & Localisation, Clinic guide,
Integrations, HairAudit discovery, Payments, Admin Users, Staff entitlements, HubSpot import

After:

Configuration, Services, Rooms, Clinic setup, Templates, Tax & Localisation, Clinic guide,
Integrations, HairAudit discovery, Payments, Admin Users, Roles & permissions, HubSpot import

- Removed the visible Staff entry and `showStaffLink`.
- Kept `showStaffAndServicesNav` for Services / Rooms / Clinic setup.
- Renamed Staff entitlements to Roles & permissions.
- Preserved `/settings/staff-access`, `showAdminUsersNav`, settings feature gate, and active-route
  matching.
- Left HubSpot import visibility and gates unchanged.

### Team legacy catalogue

- Removed only `academyos` from `FI_OS_TEAM_LEGACY_ROUTES`.
- Did not change `/team/training`, public Academy routes, or system-admin Academy routes.
- The hard-coded Team Training Academy link remains and is recorded as a follow-up blocker.

### Reports catalogue

- Removed Surgery insights and Graft count review from `FI_OS_REPORTS_LEGACY_ROUTES`.
- Retained both only in `FI_OS_REPORTS_ADMIN_LEGACY_ROUTES`.
- Admin catalog emission is once each.

### HubSpot redirect tests

- Updated the legacy redirect test to assert semantic `URLSearchParams` behaviour:
  `tab=import-review` and valid `batchId` preservation.
- Did not change redirect page implementations.

## Untouched

- HubSpot import navigation visibility
- `/staff`, `/audit`, `/workforce-os/staff-access`
- Permissions and route guards
- Team Access, Admin Users, Google Calendar, Deployment
- Primary rail
- Provider code and loaders
- Unmounted Clinic OS navigation
- Settings six-group information architecture

## Rollback

Revert the isolated 2C.1A commit. No data, permission, route, or provider rollback is required.

## Remaining blockers

1. HubSpot canonical navigation parity for CRM-read sessions without Configuration hub.
2. Hard-coded Team Training Academy link to dead `/academy`.
3. Team Access permission parity versus legacy Staff Access.
4. Admin Users identity duplication with clinic employees.
5. Settings six-group information architecture.
6. Authorised tenant Deployment route.
