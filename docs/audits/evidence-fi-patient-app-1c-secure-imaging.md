# FI-PATIENT-APP-1C — Secure Patient Imaging

**Verdict: GREEN**

| Field | Value |
|-------|-------|
| Ticket | FI-PATIENT-APP-1C |
| Closed | 2026-07-27 |
| Production identity mutations | **None** |
| Schema / migrations | **None** |
| New storage system | **None** (reuse `patient-images`) |
| Mobile application | **Not implemented** |

Companion JSON: `evidence-fi-patient-app-1c-secure-imaging.json`

---

## Scope executed

1. `GET /api/patient/v1/images` — patient-owned active images + short-lived signed thumbnails
2. `POST /api/patient/v1/images/upload-intent` — server-scoped signed upload capability
3. `POST /api/patient/v1/images/complete` — ownership/path/expiry/replay checks + FiOS registration
4. Patient-facing slot vocabulary (`front_hairline`, `top_crown`, `donor_area`) with deterministic FiOS pathway mapping
5. Structured `patient_gateway_audit` imaging events (no signed URLs / PHI bodies)
6. OpenAPI updated to v1.0.2
7. Fail-closed tests A–M

## Security proofs

| Case | Result |
|------|--------|
| A Patient A list | Only Patient A images |
| B Patient B access via filters | Empty / denied |
| C/D Foreign patient leak / claim | `ownership_denied` |
| E Invalid category | `invalid_category` |
| F Unsupported MIME | `invalid_mime` |
| G Oversized | `file_too_large` |
| H Tampered path | `path_mismatch` |
| I Intent replay | `intent_replay` |
| J Expired intent | `intent_expired` |
| K Other patient's intent | `ownership_denied` / `wrong_tenant` |
| L Staff imaging export | `createPatientImageRecord` unchanged/available |
| M Portal upload core | `buildPatientPortalImageUploadFields` + portal slots unchanged |

## Explicit non-changes

- Existing `POST /api/patient/[tenantId]/images` portal multipart upload untouched
- Staff `/api/tenants/**/images` untouched
- No patient RLS redesign / identity migration
- No service-role credentials returned to clients

## Test evidence

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGatewayImageSlots.test.ts \
  src/lib/patientPortal/patientGatewayUploadIntentCore.test.ts \
  src/lib/patientPortal/patientGatewayImagesCore.test.ts \
  src/lib/patientPortal/patientGatewayImages.server.test.ts
```

Result: **21 passed / 0 failed** (2026-07-27).
