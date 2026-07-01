# WorkforceOS Phase 1C Sprint 2 — Operational Control Layer

## Objective

Build the human operational control layer on top of Sprint 1 identity reconciliation so administrators can:

- Manually link unlinked staff to external IIOHR identities
- Review and resolve duplicate candidates
- Merge duplicate staff records safely
- Offboard staff without destroying history

Production baseline (post–Sprint 1):

```json
{
  "rowsSent": 13,
  "linked": 13,
  "created": 0,
  "updated": 0,
  "duplicatesDetected": 3,
  "unlinkedActiveStaff": 4
}
```

## Routes

| Route | Purpose |
|-------|---------|
| `/fi-admin/[tenantId]/hr-os` | Workforce Dashboard |
| `/fi-admin/[tenantId]/hr-os/sync-health` | Sync Health |
| `/fi-admin/[tenantId]/hr-os/staff-reconciliation` | Manual Staff Linking |
| `/fi-admin/[tenantId]/hr-os/duplicates` | Duplicate Review |
| `/fi-admin/[tenantId]/hr-os/offboarding` | Offboarding Centre |

## Manual identity linking workflow

1. Admin opens **Staff Reconciliation**.
2. Queue lists active `fi_staff_members` without `fi_staff_identity_links`.
3. Available external IIOHR identities (from `fi_staff_source_ids` and unlinked `source_external_id` rows) are shown per staff row.
4. Admin selects external identity and clicks **Link Identity**.
5. Server creates/upserts `fi_staff_identity_links`, updates `fi_staff_members.source_external_id`, writes `workforce_manual_identity_linked` audit event.
6. Sync health metrics refresh via `loadHrSyncHealthSummary`.

**Rules:** no auto-link on name-only conflicts; tenant-scoped validation on every mutation.

## Duplicate review workflow

1. Load open `fi_staff_duplicate_candidates` (`status = open`).
2. Display Staff A/B, similarity score, match reasons (email, name, phone, role).
3. Actions:
   - **Dismiss** → `dismissed`
   - **Keep Separate** → `dismissed` (explicit human decision)
   - **Approve Merge** → `approved_for_merge` then invokes merge utility

Statuses: `open`, `dismissed`, `approved_for_merge`, `resolved` (legacy `merged` / `manual_linked` retained).

## Merge utility architecture

Entry: `mergeStaffRecords({ tenantId, sourceStaffId, targetStaffId, mergedBy })`

Execution: Postgres RPC `workforce_merge_staff_members` inside a single transaction.

### Dependency transfer (source → target)

When both members have `fi_staff_id` projections:

- `fi_staff_identity_links` (member level)
- `fi_staff_feature_access`
- `fi_staff_source_ids`
- `fi_staff_shifts`
- `fi_staff_event_assignments`
- `fi_staff_competency_projections`
- `fi_staff_procedure_privileges`
- `fi_staff_calendar_links`
- `fi_staff_access_grants`
- `fi_staff_field_access_grants`

**TODO placeholders** (extensible): training assignments, SOP acknowledgements, compliance documents, dedicated staff notes tables.

### Archive source (never hard-delete)

```text
employment_status = merged
merged_into = targetStaffId
merged_at = now()
```

Duplicate pair → `status = resolved`.

### Rollback protections

- RPC runs in one DB transaction; failure rolls back all dependency moves.
- No hard deletes on staff, audit, or compliance history.
- Identity link conflicts (duplicate external id on target) skip move — source link preserved on archived record.

## Offboarding lifecycle

Entry: `offboardStaffMember({ tenantId, staffId, exitReason, terminatedBy })`

Migration columns on `fi_staff_members`:

- `termination_date`, `exit_reason`, `offboarded_by`
- `system_access_revoked`, `academy_access_revoked`

Actions:

- `employment_status = terminated`
- Revoke `fi_staff_feature_access`, access grants, field grants
- Cancel future shifts and roster assignments
- Deactivate calendar links
- Dual-write `fi_staff` operational row (`is_active = false`)
- Audit: `workforce_staff_offboarded`

Historical training, compliance, and audit rows are never deleted.

## Security constraints

- Server actions only (`workforce-phase-1c-sprint-2-actions.ts`)
- Roles: `owner`, `fi_admin`, `admin`, `hr_manager`
- No client-side service role
- Tenant-scoped validation on every mutation
- Audit events in `fi_staff_member_audit_events`

## Command Centre integration

`/fi-admin/[tenantId]/staff` shows operational cards:

| Card | Metric |
|------|--------|
| Sync Health | % active staff with identity links |
| Duplicate Conflicts | Open duplicate count |
| Unlinked Staff | Unlinked active staff count |
| Inactive Staff | Inactive/terminated/resigned count |

## Tests

```bash
pnpm exec tsx --test src/lib/workforce/workforcePhase1cSprint2.test.ts
```

Covers manual linking, duplicate dismiss/approve, merge RPC behaviour, offboarding revocation, audit preservation.