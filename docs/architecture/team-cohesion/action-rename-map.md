# Action-file rename map

Behaviour-neutral move/rename of sprint-era and workforce action modules into domain homes. **Destinations are based on exported responsibilities**, not sprint labels.

Shims: keep `src/lib/actions/<old-name>.ts` as one-line re-exports during migration so existing imports and sprint tests stay green.

## Map

| Current | Proposed | Domains | Notes |
|---------|----------|---------|-------|
| `workforce-onboarding-actions.ts` | `team/onboarding/actions.ts` | onboarding | Invite + create + onboarding PIN |
| `workforce-staff-access-actions.ts` | `team/access/actions.ts` | access | Login invite + suspend/revoke + access PIN |
| `workforce-roster-actions.ts` | `team/roster/actions.ts` | roster | Shift CRUD, generation, standard hours saves |
| `workforce-roster-cadence-actions.ts` | `team/roster/cadenceActions.ts` | roster | Planning policy load/save |
| `workforce-phase-1c-sprint-3-actions.ts` | `team/compliance/credentialActions.ts` | compliance | Credentials, certifications, compliance audit |
| `workforce-phase-1c-sprint-35-actions.ts` | `team/identity/reconciliationActions.ts` | identity | Manual review / merge recommendations |
| `workforce-phase-2-sprint-1-actions.ts` | `team/planning/recruitmentActions.ts` | planning | Recruitment + role requirements |
| `workforce-phase-2-sprint-2-actions.ts` | `team/payroll/payrollActions.ts` | payroll | Wage profiles + timesheet transitions |
| `workforce-phase-2-sprint-4-actions.ts` | `team/planning/procedureStaffingActions.ts` | planning | Apply recommended procedure team |
| `workforce-phase-2-sprint-5-actions.ts` | `team/planning/planningActions.ts` | planning | Refresh planning engine |

## Split required (do not rename as one mixed file)

### `workforce-phase-1c-sprint-2-actions.ts`

| Exports | Destination |
|---------|-------------|
| `manuallyLinkStaffIdentityAction` | `team/identity/identityLinkActions.ts` |
| `dismissDuplicateCandidateAction` | `team/identity/identityLinkActions.ts` |
| `keepDuplicateSeparateAction` | `team/identity/identityLinkActions.ts` |
| `approveDuplicateMergeAction` | `team/identity/identityLinkActions.ts` |
| `mergeStaffRecordsAction` | `team/identity/identityLinkActions.ts` |
| `offboardStaffMemberAction` | `team/identity/offboardingActions.ts` |

Offboarding stays under **identity** (employment termination), not **access**.

Old path becomes a shim re-exporting from both new modules.

## Related non-sprint actions (optional follow-ons)

Keep tracked so they land in the same domain homes when convenient:

| Current | Proposed |
|---------|----------|
| `staff-time-clock-actions.ts` | `team/payroll/timeClockActions.ts` |

(Not sprint-named; listed because it already sits outside the three lib trees but owns payroll behaviour.)

## Export inventory (for verification)

Full export lists are in `generated/b0-inventory.json` → `actionRenameMap`. Spot-check when renaming: typecheck must still see every previous export name from the shim path until all callers are updated.
