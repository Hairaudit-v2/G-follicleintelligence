# WorkforceOS Phase 1C Sprint 3 — Clinical Workforce Intelligence

## Objective

WorkforceOS moves from operational HR control (Sprint 2) to real-time clinical workforce intelligence:

- Credential and license expiry management
- Clinical certification tracking
- Clinical eligibility engine
- Compliance automation with deduplicated alerts
- SurgeryOS and CalendarOS assignment gates
- Daily compliance cron

## Architecture

### Credential management

**Table:** `fi_staff_credentials` (migration `202610017004`, aligned in `202610017005`)

| Field | Purpose |
|-------|---------|
| `credential_type` | AHPRA Registration, Medical License, etc. |
| `issuing_body` | Regulatory body |
| `credential_number` | License/registration number |
| `expires_at` | Expiry timestamp |
| `status` | `active`, `expiring_soon`, `expired`, `suspended`, `revoked` |
| `reminder_sent` | Expiry reminder flag |

**Logic:** `evaluateCredentialExpiry()` — if `expires_at < today` → `expired`; if within 30 days → `expiring_soon`.

**Server:** `src/lib/workforce/staffCredentials.server.ts`

- `createStaffCredential()`
- `updateStaffCredential()`
- `loadStaffCredentials()`
- `checkExpiringCredentials()`

### Certification management

**Table:** `fi_staff_certifications`

| Field | Purpose |
|-------|---------|
| `certification_name` | FUE Extraction, PRP Protocol, etc. |
| `certification_type` | Free-text category |
| `issuing_organization` | Training provider |
| `competency_score` | Numeric competency |
| `verified` | HR verification flag |
| `expires_at` | Expiry (affects eligibility score) |

**Server:** `src/lib/workforce/staffCertification.server.ts`

- `createCertification()`
- `verifyCertification()`
- `loadCertificationHistory()`
- `loadExpiringCertifications()`

### Clinical eligibility engine

**Server:** `src/lib/workforce/clinicalEligibility.server.ts`

```ts
calculateStaffClinicalEligibility({ tenantId, staffId })
```

Evaluates employment, credentials, certifications, training, SOP acknowledgements, manager approval, role permissions, compliance alerts.

**States:** `eligible`, `restricted`, `non_clinical`, `expired_credentials`, `training_incomplete`, `compliance_blocked`, `inactive`

**Return:**

```json
{
  "eligible": true,
  "status": "eligible",
  "score": 92,
  "blockingReasons": []
}
```

Resolves `staffId` as either `fi_staff_members.id` or `fi_staff.id` via `workforceStaffMemberResolve.server.ts`.

### Compliance automation

**Table:** `fi_staff_compliance_alerts` — upsert dedup on `(tenant_id, staff_member_id, alert_type)`

**Severities:** `low`, `medium`, `high`, `critical`

**Server:** `src/lib/workforce/complianceAutomation.server.ts` — `runStaffComplianceAudit(tenantId)`

Checks: expired credentials/certs, offboarded with permissions, calendar on inactive, suspended on surgery.

**Audit runs:** `fi_workforce_compliance_runs`

### SurgeryOS integration

`assertStaffMeetsClinicalEligibilityForAssignment()` in `clinicalEligibilityGate.server.ts` runs **after** existing SurgeryOS permission and readiness layers:

- `assertStaffClinicallyAvailableForAssignment()` (CalendarOS / booking pickers)
- `assignStaffToClinicalEventAction()` (WorkforceOS rostering — surgery/calendar events)

Does not bypass `allowBlockedDraft` override path.

### CalendarOS integration

Same gate via `assertStaffClinicallyAvailableForAssignment()` — blocks inactive, suspended, offboarded, expired credentials, failed compliance.

### Daily compliance cron

**Route:** `GET|POST /api/cron/workforce-compliance-audit`

**Auth:** `Authorization: Bearer $CRON_SECRET` (or `WORKFORCE_COMPLIANCE_CRON_SECRET`)

**Tasks per tenant:**

1. `runStaffComplianceAudit()`
2. `checkExpiringCredentials()`
3. Sync certification statuses
4. Generate/resolve compliance alerts

### HR OS routes

| Route | Component |
|-------|-----------|
| `/fi-admin/[tenantId]/hr-os/credentials` | `StaffCredentialsClient` |
| `/fi-admin/[tenantId]/hr-os/certifications` | `StaffCertificationClient` |
| `/fi-admin/[tenantId]/hr-os/compliance` | `StaffComplianceClient` |

### Command centre intelligence cards

`workforceOperationalMetrics.server.ts` adds:

- Clinically Eligible Staff
- Expiring Credentials
- Compliance Alerts
- Expired Certifications

## Safety constraints

- No hard deletes — `archived_at` pattern preserved
- SurgeryOS / CalendarOS permission layers not bypassed
- Credentials not exposed outside HR admin RLS
- Mutations require `owner`, `fi_admin`, `admin`, `hr_manager`
- Compliance alerts auditable via `fi_staff_member_audit_events`
- Cron protected by `CRON_SECRET`

## Tests

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test src/lib/workforce/workforcePhase1cSprint3.test.ts
```

## Migrations

| Version | Purpose |
|---------|---------|
| `202610017004` | Initial Sprint 3 tables (applied to production) |
| `202610017005` | Spec alignment — `issuing_body`, `expiring_soon`, alerts, audit runs |