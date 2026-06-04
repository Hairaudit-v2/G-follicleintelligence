# Patient profile foundation (Stages 4A–4D)

## Purpose

Stage 4A establishes the **patient** (`fi_patients` + `fi_persons`) as the **longitudinal anchor** inside Follicle Intelligence admin: a searchable directory, a profile shell with linked CRM, cases, and bookings, and **non-clinical** admin fields (`patient_status`, `admin_note`). It intentionally does **not** ship imaging, labs, HLI, HairAudit, surgery planning, or prescriptions — those attach in later stages.

**Stage 4B** adds the first **structured clinical summary** layer (`fi_patient_clinical_details`): bounded text fields plus JSON `clinical_flags` / `metadata` for staff-maintained context. This is **not** the HLI diagnostic engine, not surgery planning, and not imaging — it is a safe foundation that later modules (HLI, trichoscopy, HairAudit exports, SurgeryOS) can read without inventing ad-hoc columns on `fi_patients`.

**Stage 4D** adds a **read-only treatment timeline** on the profile: a sanitised merge of leads, CRM activity, bookings, cases, clinical timestamps, imaging events, and patient-admin metadata bumps. It does **not** add a patient-native activity writer, timeline editing, or patient-facing views. See `docs/design/23-patient-treatment-timeline.md`.

This layer aligns with the broader **digital twin** direction: a stable tenant-scoped identity and timeline spine that future clinical modules (trichoscopy, HLI scoring, HairAudit exports, SurgeryOS) will reference without duplicating person/patient primitives.

## Stage 4B — clinical details foundation

### Table: `fi_patient_clinical_details`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `tenant_id` | Tenant scope |
| `patient_id` | FK → `fi_patients`, **unique per `(tenant_id, patient_id)`** |
| `person_id` | Nullable FK → `fi_persons`; **always aligned server-side** with the patient’s `person_id` on write |
| Text columns | Bounded clinical summary fields (see policy constants); all nullable |
| `clinical_flags`, `metadata` | JSONB objects only (`{}` default); CHECK constraints |
| `created_by_user_id`, `updated_by_user_id` | Optional FK → `fi_users`; set **only server-side** from the signed-in tenant member when available |
| `created_at`, `updated_at` | Server-maintained timestamps on write |

Indexes: `(tenant_id, patient_id)`, `(tenant_id, person_id)`, `(tenant_id, updated_at desc)`.

RLS: **authenticated** tenant members may **SELECT**; **INSERT/UPDATE/DELETE** are intended for **service role** (API routes using `supabaseAdmin`), matching other foundation write patterns.

Migration: `20260612120001_fi_patient_clinical_details.sql`.

### Clinical summary vs deferred

| In scope (Stage 4B) | Explicitly deferred |
| --- | --- |
| Staff-editable structured text + JSON flags/metadata | Patient image upload, trichoscopy library |
| Create-on-first-save empty row | Blood analysis, AI diagnosis |
| Tenant + patient integrity checks | HLI assessment engine, HairAudit integration |
| PATCH + server action with CRM write gate | Surgery planning, prescriptions, medication ordering |
| | **Patient-native** CRM-style activity automation (Stage 4D ships **read-only** profile timeline aggregation only — see `23-patient-treatment-timeline.md`) |

### Activity decision

There is **no patient-native activity table** in FI OS yet. The profile **Activity** card remains a **read-only view of `fi_crm_activity_events`** (leads / cases / `patient_id`). **Clinical detail edits are not written into CRM activity** — that would mix clinical metadata into CRM-native events without a dedicated patient stream. A future **patient activity** writer may log events such as `clinical_details.created` / `clinical_details.updated` with **`changed_keys` only** (no clinical narrative in payloads). Until that exists, this behaviour is **documented and deferred**.

### Future relationship to HLI and SurgeryOS

- **HLI** (when shipped) should treat `fi_patient_clinical_details` as **optional staff context** alongside generated scores — not as the source of automated diagnosis.
- **SurgeryOS** should reference the same row for **pre-op context** only; operative planning data belongs in future surgery-specific tables.

### Pure helpers (Stage 4B)

| Module | Responsibility |
| --- | --- |
| `clinicalDetailsPolicy.ts` | Text maxima, JSON object guard, editable key allow-list, `normalizeEditableClinicalDetailsPayload`, empty-row policy helper, tenant/patient row match helper |
| `clinicalDetailsChangedFields.ts` | `clinicalDetailsChangedKeys` for safe diff metadata (keys only) |
| `clinicalDetailsLabels.ts` | UI labels for each editable field |
| `clinicalDetailsMerge.ts` | PATCH merge (undefined = no change) |
| `clinicalDetailsApiSchemas.ts` | Zod body for PATCH / server action |
| `clinicalDetailsServer.ts` | `loadPatientClinicalDetails`, `upsertPatientClinicalDetails`, `updatePatientClinicalDetails` (server-only) |

Re-exports: `src/lib/patients/index.ts` includes the **pure** modules above (not `clinicalDetailsServer.ts`).

### Mutations & API (Stage 4B)

- **Server action:** `updatePatientClinicalDetailsAction` in `lib/actions/fi-patient-actions.ts` — same CRM write gate as admin PATCH, `revalidatePath` for directory + profile.
- **HTTP:** `PATCH /api/tenants/[tenantId]/patients/[patientId]/clinical-details` — same validation; service-role upsert.
- **Stage 4C images:** `POST` / `PATCH` / archive `POST` under `/api/tenants/[tenantId]/patients/[patientId]/images` — see `22-patient-images-foundation.md`; server actions `updatePatientImageDetailsAction`, `archivePatientImageAction`.

### UI

- **`PatientClinicalDetailsCard`** on the patient profile (full-width section above the two-column grid): edit / save / cancel, textareas, optional collapsible JSON editors, last updated + updater email when `updated_by_user_id` resolves.

## Routes

| Route | Description |
| --- | --- |
| `/fi-admin/[tenantId]/patients` | Searchable patient directory (paginated). |
| `/fi-admin/[tenantId]/patients/[patientId]` | Patient profile. `patientId` resolves to `fi_patients.id` first; if only a legacy `fi_global_patients` stub exists, the page falls back to the **Universal Patient Record** (read-only aggregate) with a banner. |

Access gate: **`assertCrmShellPageAccess`** (same roles as CRM / Bookings / Calendar / System Status). Nav includes **Patients** beside those modules.

## Data sources

- **`fi_patients`** — canonical tenant patient; Stage 4A adds `admin_note`, `patient_status`, uses existing `updated_at`.
- **`fi_patient_clinical_details`** — Stage 4B structured clinical summary (one row per patient when created).
- **`fi_persons`** — display / contact signals from `metadata` (no raw PII migration here).
- **`fi_crm_leads`** — leads linked by `patient_id`.
- **`fi_cases`** — `foundation_patient_id` link; case “type” surfaced from `metadata` keys when present.
- **`fi_bookings`** — `patient_id` anchor; upcoming vs past split in UI.
- **`fi_crm_activity_events`** — read-only union: `patient_id` match **or** `lead_id` / `case_id` in the sets loaded for this profile.

## Loaders (server-only)

| Loader | Responsibility |
| --- | --- |
| `src/lib/patients/patientDirectoryLoader.ts` | Paginated directory rows + counts (active cases, linked leads, latest booking). |
| `src/lib/patients/patientProfileLoader.ts` | Foundation profile graph + summary metrics; legacy global anchor detection; **Stage 4B:** `clinicalDetails` bundle (`row` + `updatedByLabel`). **Stage 4C:** `patientImages` bundle (counts, active tiles with signed URLs, archived rows without URLs). **Stage 4D:** `patientTimeline` (sanitised aggregated items, default latest 100). |

## Pure helpers

| Module | Responsibility |
| --- | --- |
| `patientPolicy.ts` | Status allow-list, admin note max length, normalization. |
| `patientDirectoryQuery.ts` | URL search-param parsing + href builders. |
| `patientProfileSummary.ts` | Summary metrics, booking split, activity sort, linked lead counts. |
| `src/lib/patients/timeline/*` (pure) | Timeline types, labels, filters, deterministic `buildPatientTimeline` (Stage 4D). |
| `patientLabels.ts` | Status labels + `displayFromPersonMetadata`. |
| `patientApiSchemas.ts` | Zod body for admin PATCH / server action. |
| Stage 4B clinical modules | See **Stage 4B — clinical details foundation** above. |
| `index.ts` | Re-exports **pure** modules only (loaders and `clinicalDetailsServer` imported from their files). |

## UI components

Under `src/components/fi/patients/`:

- `PatientDirectoryPage`, `PatientDirectoryFilters`, `PatientDirectoryTable`, `PatientDirectoryRow`, `PatientStatusBadge`
- `PatientProfilePage`, `PatientProfileHeader`, `PatientProfileSummaryCards`, `PatientPersonDetailsCard`, `PatientLinkedLeadsCard`, `PatientBookingsCard`, `PatientCasesCard`, `PatientActivityCard`, `PatientAdminNotesCard`, **`PatientClinicalDetailsCard`**, **`PatientImagesCard`**, **`PatientTreatmentTimelineCard`** (`src/components/fi/patients/timeline/*`) (and `src/components/fi/patient-images/*` building blocks)

## Mutations & API

- **Server action:** `updatePatientAdminDetailsAction` in `lib/actions/fi-patient-actions.ts` — tenant write gate, bounded fields, `revalidatePath` for directory + profile.
- **HTTP:** `PATCH /api/tenants/[tenantId]/patients/[patientId]` — same validation; service-role update (RLS unchanged: authenticated still has no direct `fi_patients` UPDATE policy).

**Activity (Stage 4A admin):** Editing admin details does **not** append `fi_crm_activity_events` (would require a lead anchor or a future patient-native stream). Deferred to a later stage; profile reads existing CRM activity only.

## Tests

`src/lib/patients/stage4a.test.ts` — policy, schema, query parsing, metrics, booking split, lead counts, activity ordering.

`src/lib/patients/stage4b.test.ts` — clinical text limits, JSON object validation, `changed_keys`, strict schema, empty-row policy, tenant match helper, sparse PATCH merge.

`src/lib/patientImages/stage4c.test.ts` — image policy (categories, MIME, size, metadata), paths, `changed_keys`, archived-edit guard, signed-URL descriptor shape.

`src/lib/patients/stage4d.test.ts` — timeline build, sorting, sanitisation, filters, grouping, pagination flags.

## Intentionally deferred

- AI image analysis, HairAudit image scoring, surgery bulk imaging, trichoscopy measurement library, before/after engines, annotation, patient-facing galleries (Stage 4C covers **staff private** images only).
- Blood analysis ingestion
- HLI diagnostic engine
- HairAudit integration
- SurgeryOS / prescriptions / automated treatment timelines
- Dedicated **patient-scoped** activity writer (read CRM activity only in 4A; clinical and image edits not mirrored to CRM in 4B/4C; `changed_keys` collected for future patient-native audit)

## Migrations

- `20260611120001_fi_patients_admin_fields.sql` — `admin_note`, `patient_status` + check constraint.
- `20260612120001_fi_patient_clinical_details.sql` — Stage 4B clinical summary table + RLS.
- `20260613120001_fi_patient_images.sql` — Stage 4C image metadata table + RLS + `patient-images` storage bucket.

## Related docs

- `docs/design/20-system-status-and-readiness.md` — feature registry rows for Patients / HLI / HairAudit / SurgeryOS; core table list includes `fi_patient_images`.
- `docs/design/22-patient-images-foundation.md` — Stage 4C private imaging layer (bucket, RLS, API, UI).
- `docs/design/19-booking-calendar-foundation.md` — booking anchors including `patient_id`.
- `docs/design/11-universal-patient-record.md` — legacy/global aggregate UI still used when no foundation row exists.
