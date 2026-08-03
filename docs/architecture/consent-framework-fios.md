# FI OS Consent Framework

**Status:** Sprint A + Sprint B complete. Phase C later (PDF, drawn signature, legal-final templates).  
**Owner:** FI OS clinical / patient profile  
**Principle:** FI owns consent. Do not regress to paper-only as system of truth. Timely digital consents are not integrated (API constraints).

## Why

- Clinics need treatment-driven digital consents (surgery, PRP, exosomes, photography, privacy).
- Existing vault (`fi_patient_documents` with `document_type = consent`) remains optional **file evidence**.
- Journey / surgery blockers (`missing_consent`, consent attention chips) land on staff Required consents panel — never 404.
- Patients complete outstanding forms via secure link (no full patient-app login for v1).

## Phase A (done) — foundation

| Deliverable | Location |
| --- | --- |
| Schema + RLS | `supabase/migrations/20261106120001_fi_consent_framework_sprint_a.sql` |
| Tables | `fi_consent_templates`, `fi_patient_consent_instances` |
| Evolved draft seed | Same migration (slugs: `evolved`, `evolved-hair`, `evolved-hair-clinics`) |
| Resolver | `src/lib/consents/consentRequirementResolver.ts` (+ `.server.ts`) |
| Ensure outstanding | `ensureOutstandingConsentInstances` |
| Status summary | `getPatientConsentStatusSummary` → `{ required, signed, outstanding, allRequiredSigned }` |
| Staff panel | Patient profile → **Documents** tab → **Required consents** (`#required-consents`) |
| Chip / calendar href | `?tab=documents#required-consents` |
| Staff-assisted sign | `channel = staff_assisted` |

### Form keys

- `photo_clinical`
- `privacy_treatment`
- `surgery_procedure`
- `prp_treatment`
- `exosome_treatment`

### Resolver signals (no new treatment-plan tables)

- Active patient → baseline `privacy_treatment` + `photo_clinical`
- Open bookings: type/title contains surgery / prp / exosome → matching treatment keys
- Imaging present → `photo_clinical`
- Cancelled / no-show bookings ignored

### Draft legal text

All seeded `body_md` values include a visible **DRAFT — not legal-final** banner. Staff must not treat templates as lawyer-approved until counsel replaces copy.

### Soft failure

If consent tables are not migrated, the patient profile still loads. The Required consents panel shows a non-blocking message.

## Phase B (done) — patient e-sign links

| Deliverable | Location |
| --- | --- |
| Access tokens | `fi_consent_access_tokens` — `20261107120001_fi_consent_access_tokens_sprint_b.sql` |
| Hash-only storage | SHA-256 of opaque raw token; raw only in URL |
| Issue / resolve / sign | `src/lib/consents/consentAccessToken.server.ts` |
| Pure helpers + tests | `consentAccessTokenCore.ts` / `.test.ts` |
| Public page | `/consent/[token]` (optional `?device=clinic`) |
| Staff actions | **Copy patient link**, **Open for clinic device** on Required consents panel |
| Photo / trial gate | Prefer signed `photo_clinical`; fallback vault document |
| Journey consent dual-run | `consentSigned` = consultation proxy **OR** framework (`surgery_procedure` signed **or** photo+privacy signed) |

### Channels

| Channel | When |
| --- | --- |
| `fi_patient_link` | Patient opens copied link on their phone |
| `fi_clinic_device` | Staff **Open for clinic device** (`?device=clinic`) |
| `staff_assisted` | Staff records sign-off in clinic |
| `upload` | Optional vault evidence (document still separate) |

### Token rules

- Default expiry: **7 days**
- Valid until instance is **signed** or `expires_at` (mark `used_at` on successful sign)
- No general authenticated RLS select on tokens — service role only
- Structured logs: `tenantId`, `instanceId`, `outcome` — **no PHI**, no raw token

### Public URL

```
{FI_PUBLIC_APP_URL}/consent/{opaqueToken}
{FI_PUBLIC_APP_URL}/consent/{opaqueToken}?device=clinic
```

Uses `buildFiPublicAppUrl` (same public origin as staff invites).

### Gate dual-run (documented)

1. **Photo gate** (`patientConsentGate.server.ts`):  
   `photo_clinical` signed **OR** existing `fi_patient_documents` consent row.
2. **Journey `consentSigned`**:  
   consultation/quote proxy **OR** framework surgery / baseline signed keys.  
   Does not rewrite Surgery OS stored checklist flags; alerts derived from journey/proxy clear when framework signals fire.
3. Manual checklist flags on Surgery OS rows remain until a later product rewire.

## Phase C (later)

- PDF snapshot of signed consent
- Drawn signature canvas
- Legal-final template bodies (replace DRAFT seeds)
- Tighter booking lifecycle (auto-issue links on booking create)
- Full Surgery OS checklist write-path sync to `allRequiredSigned`

## Out of scope (still)

- Form CMS / rich editor
- Timely sync
- Multi-tenant template marketplace
- Replacing all clinical intake forms

## Related surfaces

- Consent vault upload: `PatientConsentVaultCard` + `/api/tenants/.../documents`
- Photo gate: `patientConsentGate.server.ts` + `patientConsentGateCore.ts`
- Journey blockers: `patientJourneyState.server.ts`
- Calendar blockers: `calendarIntelligenceCore.ts`
