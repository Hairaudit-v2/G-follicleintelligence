# Patient profile foundation (Stage 4A)

## Purpose

Stage 4A establishes the **patient** (`fi_patients` + `fi_persons`) as the **longitudinal anchor** inside Follicle Intelligence admin: a searchable directory, a profile shell with linked CRM, cases, and bookings, and **non-clinical** admin fields (`patient_status`, `admin_note`). It intentionally does **not** ship imaging, labs, HLI, HairAudit, surgery planning, or prescriptions — those attach in later stages.

This layer aligns with the broader **digital twin** direction: a stable tenant-scoped identity and timeline spine that future clinical modules (trichoscopy, HLI scoring, HairAudit exports, SurgeryOS) will reference without duplicating person/patient primitives.

## Routes

| Route | Description |
| --- | --- |
| `/fi-admin/[tenantId]/patients` | Searchable patient directory (paginated). |
| `/fi-admin/[tenantId]/patients/[patientId]` | Patient profile. `patientId` resolves to `fi_patients.id` first; if only a legacy `fi_global_patients` stub exists, the page falls back to the **Universal Patient Record** (read-only aggregate) with a banner. |

Access gate: **`assertCrmShellPageAccess`** (same roles as CRM / Bookings / Calendar / System Status). Nav includes **Patients** beside those modules.

## Data sources

- **`fi_patients`** — canonical tenant patient; Stage 4A adds `admin_note`, `patient_status`, uses existing `updated_at`.
- **`fi_persons`** — display / contact signals from `metadata` (no raw PII migration here).
- **`fi_crm_leads`** — leads linked by `patient_id`.
- **`fi_cases`** — `foundation_patient_id` link; case “type” surfaced from `metadata` keys when present.
- **`fi_bookings`** — `patient_id` anchor; upcoming vs past split in UI.
- **`fi_crm_activity_events`** — read-only union: `patient_id` match **or** `lead_id` / `case_id` in the sets loaded for this profile.

## Loaders (server-only)

| Loader | Responsibility |
| --- | --- |
| `src/lib/patients/patientDirectoryLoader.ts` | Paginated directory rows + counts (active cases, linked leads, latest booking). |
| `src/lib/patients/patientProfileLoader.ts` | Foundation profile graph + summary metrics; legacy global anchor detection. |

## Pure helpers

| Module | Responsibility |
| --- | --- |
| `patientPolicy.ts` | Status allow-list, admin note max length, normalization. |
| `patientDirectoryQuery.ts` | URL search-param parsing + href builders. |
| `patientProfileSummary.ts` | Summary metrics, booking split, activity sort, linked lead counts. |
| `patientLabels.ts` | Status labels + `displayFromPersonMetadata`. |
| `patientApiSchemas.ts` | Zod body for admin PATCH / server action. |
| `index.ts` | Re-exports **pure** modules only (loaders imported from their files). |

## UI components

Under `src/components/fi/patients/`:

- `PatientDirectoryPage`, `PatientDirectoryFilters`, `PatientDirectoryTable`, `PatientDirectoryRow`, `PatientStatusBadge`
- `PatientProfilePage`, `PatientProfileHeader`, `PatientProfileSummaryCards`, `PatientPersonDetailsCard`, `PatientLinkedLeadsCard`, `PatientBookingsCard`, `PatientCasesCard`, `PatientActivityCard`, `PatientAdminNotesCard`

## Mutations & API

- **Server action:** `updatePatientAdminDetailsAction` in `lib/actions/fi-patient-actions.ts` — tenant write gate, bounded fields, `revalidatePath` for directory + profile.
- **HTTP:** `PATCH /api/tenants/[tenantId]/patients/[patientId]` — same validation; service-role update (RLS unchanged: authenticated still has no direct `fi_patients` UPDATE policy).

**Activity:** Editing admin details does **not** append `fi_crm_activity_events` (would require a lead anchor or a future patient-native stream). Deferred to a later stage; profile reads existing CRM activity only.

## Tests

`src/lib/patients/stage4a.test.ts` — policy, schema, query parsing, metrics, booking split, lead counts, activity ordering.

## Intentionally deferred

- Patient image upload & trichoscopy library
- Blood analysis ingestion
- HLI diagnostic engine
- HairAudit integration
- SurgeryOS / prescriptions / automated treatment timelines
- Dedicated **patient-scoped** activity writer (read CRM activity only in 4A)

## Migrations

- `20260611120001_fi_patients_admin_fields.sql` — `admin_note`, `patient_status` + check constraint.

## Related docs

- `docs/design/20-system-status-and-readiness.md` — feature registry rows for Patients / HLI / HairAudit / SurgeryOS.
- `docs/design/19-booking-calendar-foundation.md` — booking anchors including `patient_id`.
- `docs/design/11-universal-patient-record.md` — legacy/global aggregate UI still used when no foundation row exists.
