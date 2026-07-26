# FI-PATIENT-APP-1B — Patient Gateway Foundation

**Verdict: GREEN**

| Field | Value |
|-------|-------|
| Ticket | FI-PATIENT-APP-1B |
| Closed | 2026-07-27 |
| Production patient/identity mutations | **None** |
| Schema / migrations | **None** |
| Mobile application | **Not implemented** |
| Messaging | **Not implemented** |

Companion JSON: `evidence-fi-patient-app-1b-gateway-foundation.json`

---

## Scope executed

Foundational authentication + ownership layer for `/api/patient/v1` only:

1. Shared resolver `requirePatientGatewayContext` (Bearer JWT required; no cookie fallback)
2. Canonical patient derived from `fi_patients.portal_auth_user_id` server-side
3. `GET /api/patient/v1/me` patient-safe profile
4. Reusable ownership guards for clinical / images / appointments / billing / documents
5. Structured security audit logs (`patient_gateway_audit`) without secrets/PHI/signed URLs
6. Fail-closed tests A–I
7. OpenAPI updated for implemented auth + `/me`

## Security proofs

| Case | Result |
|------|--------|
| A Valid patient bearer | Resolves that portal patient only |
| B No bearer | `401 unauthenticated` |
| C Invalid bearer | `401 invalid_token` |
| D No portal mapping | `403 unlinked` |
| E Ambiguous mapping | `403 ambiguous_mapping` |
| F Foreign patientId claim | `403 ownership_denied` — cannot change resolved patient |
| G Wrong tenant claim | `403 wrong_tenant` |
| H Inactive/archived patient | `403 inactive_patient` |
| I Staff admin-key elevator | `403 staff_credential_rejected` |

## Explicit non-changes

- Existing `/patient/*` cookie portal flows untouched
- Existing `POST /api/patient/[tenantId]/images` untouched
- Staff `/api/tenants/**` CRM gates untouched
- No `portal_auth_user_id` backfill / identity migration
- No patient RLS redesign
- No broad clinical dataset exposure

## Test evidence

Command:

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGatewayGateCore.test.ts \
  src/lib/patientPortal/patientGatewayOwnershipCore.test.ts \
  src/lib/patientPortal/patientGatewayMeCore.test.ts \
  src/lib/patientPortal/patientGatewayGate.server.test.ts
```

Result: **28 passed / 0 failed** (2026-07-27).

## Artifacts

| Path | Role |
|------|------|
| `app/api/patient/v1/me/route.ts` | Implemented `/me` |
| `src/lib/patientPortal/patientGatewayGate.server.ts` | Context resolver |
| `src/lib/patientPortal/patientGatewayOwnership.server.ts` | Audited ownership wrappers |
| `docs/architecture/fi-patient-app-1a-openapi.yaml` | Contract updated (v1.0.1) |
