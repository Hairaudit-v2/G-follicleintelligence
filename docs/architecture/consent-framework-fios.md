# FI OS Consent Framework

**Status:** Sprint A complete (foundation). Sprint B next (patient e-sign link).  
**Owner:** FI OS clinical / patient profile  
**Principle:** FI owns consent. Do not regress to paper-only as system of truth. Timely digital consents are not integrated (API constraints).

## Why

- Clinics need treatment-driven digital consents (surgery, PRP, exosomes, photography, privacy).
- Existing vault (`fi_patient_documents` with `document_type = consent`) remains optional **file evidence**.
- Journey / surgery blockers (`missing_consent`, consent attention chips) must land on a real staff surface — never 404.

## Phase A (done)

| Deliverable | Location |
| --- | --- |
| Schema + RLS | `supabase/migrations/20261106120001_fi_consent_framework_sprint_a.sql` |
| Tables | `fi_consent_templates`, `fi_patient_consent_instances` |
| Evolved draft seed | Same migration (slugs: `evolved`, `evolved-hair`, `evolved-hair-clinics`) |
| Resolver | `src/lib/consents/consentRequirementResolver.ts` (+ `.server.ts`) |
| Ensure outstanding | `ensureOutstandingConsentInstances` |
| Status summary | `getPatientConsentStatusSummary` → `{ required, signed, outstanding, allRequiredSigned }` |
| Staff panel | Patient profile → **Documents** tab → **Required consents** (`#required-consents`) |
| Chip / calendar href | `?tab=documents#required-consents` (aliases `consent` / `consents` → documents) |
| Staff-assisted sign | Interim mutation (`channel = staff_assisted`) until patient link |

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

## Phase B (next)

- Patient-facing e-sign page + magic links (`channel = fi_patient_link`)
- Optional clinic device flow (`fi_clinic_device`)
- Wire photo / trial gates and surgery readiness more fully to `allRequiredSigned` (helper already exported)
- Replace draft template bodies with legal-final text

## Out of scope (later)

- Form CMS / rich editor
- Timely sync
- PDF generation
- Drawn signature
- Full surgery procedure-day product

## Related surfaces

- Consent vault upload: `PatientConsentVaultCard` + `/api/tenants/.../documents`
- Photo gate (document presence): `patientConsentGate.server.ts` — not fully rewired in Sprint A
- Journey blocker href: `patientJourneyState.server.ts`
- Calendar blocker href: `calendarIntelligenceCore.ts` `buildCalendarBlockerFixHref`
