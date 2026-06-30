# WorkforceOS — Staff Lifecycle Management (Phase 1C)

Operational workforce identity governance: edit staff safely, manage employment lifecycle, archive without deletion, reconcile HR links, and audit every change.

## Routes

| Route | Purpose |
|-------|---------|
| `/fi-admin/[tenantId]/workforce-os` | Staff directory with lifecycle filters |
| `/fi-admin/[tenantId]/workforce-os/staff/[staffId]` | Staff profile + operational actions |
| `/fi-admin/[tenantId]/workforce-os/hr-reconciliation` | HR identity reconciliation queue |

Legacy `/hr-os` and `/staff` routes remain; WorkforceOS nav now points to `/workforce-os`.

## Editing rules

### Local records (`identity_source = local`)

All profile fields editable: name, email, role, employment status, timezone, notes, etc.

### IIOHR-managed records (`identity_source = iiohr_evolved_hr`)

**Read-only (externally managed):**

- Name
- Email
- Employment status
- Role

**Editable local metadata:**

- Notes
- Timezone
- Internal tags
- Clinic assignment
- Professional title / phone (local overlay)

UI shows **Managed by IIOHR HR** badge when external authority applies.

## Employment lifecycle states

| Status | Operational effect |
|--------|-------------------|
| `active` | Full operational eligibility (subject to readiness) |
| `inactive` | Deactivated |
| `on_leave` | Removed from scheduling / roster / surgery pools |
| `pending_onboarding` | Onboarding in progress |
| `terminated` | Readiness score = 0, operationally ineligible |
| `resigned` | Same as terminated |
| `contract_ended` | Same as terminated |
| `suspended` | Procedure participation blocked; readiness warnings |

**Never hard-delete** `fi_staff` or `fi_staff_members`. Use archival instead.

## Archive workflow

1. **Archive Staff** sets `archived_at` on projection + `fi_staff`.
2. Archived staff hidden from default directory (toggle **Show archived staff**).
3. Retained permanently: training, SOP, permissions, audit, surgery, documents.
4. **Restore Staff** clears `archived_at` and reactivates when employment status is `active`.

Audit events: `staff_archived`, `staff_restored`.

## HR reconciliation workflow

1. Sync ensures every `fi_staff` row has a `fi_staff_members` projection.
2. Unlinked staff appear on `/workforce-os/hr-reconciliation`.
3. **Priority 1 — exact email match (case-insensitive):** manual approve only; never auto-link in UI without admin action.
4. **Priority 2 — name similarity ≥ 60%:** suggestion only; `canAutoApprove = false`.
5. Skipped: blank email, duplicate matches, conflicting links.

On approval:

- `iiohr_staff_record_id`, `iiohr_user_id`
- `source_system = iiohr_evolved_hr`
- `identity_source = iiohr_evolved_hr`
- `source_synced_at`, `source_snapshot`

Audit event: `staff_hr_reconciled`.

## Manual HR linking

On staff profile: **Link HR Identity** (owner / admin / hr_manager only).

Audit events: `staff_hr_linked_manually`, `staff_hr_link_removed`.

## Audit model

Append-only `fi_staff_member_audit_events`:

| Event | When |
|-------|------|
| `staff_profile_updated` | Profile edit saved |
| `staff_employment_status_changed` | Manage Employment applied |
| `staff_archived` / `staff_restored` | Archive workflow |
| `staff_hr_reconciled` | Reconciliation approve |
| `staff_hr_linked_manually` | Manual link |
| `staff_hr_link_removed` | HR link removed |

## Readiness integration

`workforceReadinessEngine.ts` accepts optional `employment_status`:

- **Terminated / resigned / contract_ended:** `score = 0`, `operationally_ineligible = true`
- **Suspended:** warnings + `operationally_ineligible = true`
- **On leave:** `employment_on_leave` warning; excluded from scheduling pools

## Library modules

| Module | Role |
|--------|------|
| `staffLifecycleCore.ts` | Pure rules — field locking, reconciliation suggestions |
| `staffLifecycle.server.ts` | Profile, employment, archive mutations |
| `hrReconciliation.server.ts` | Unlinked staff, approve/reject, projections |
| `workforceOsDirectoryLoader.server.ts` | Page data loaders |

## Design principle

This is **not** employee record software. It answers:

> Is this person currently eligible, approved, and operationally valid to participate in the clinic workforce?

Never destroy staff history. Preserve governance history permanently.
