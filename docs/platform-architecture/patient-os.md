# Module: PatientOS

## Purpose

Unified patient record and Patient Twin™ foundation: demographics, clinical details, timeline, images, pathology, medication, cases, and longitudinal treatment history. PatientOS is the clinical identity layer every downstream module references.

## Dependencies

- **Platform Core** — persons, tenants, timeline infrastructure
- **LeadFlow** — lead → person conversion
- **ClinicOS / CalendarOS** — appointment history
- **ConsultationOS** — assessment and plans
- **ImagingOS** — clinical photography (cross-module)
- **SurgeryOS** — cases and procedures
- **FinancialOS** — invoices linked to patient

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `patient.created` | Timeline / target bus | Partial |
| `patient.updated` | CRM activity (on conversion path) | Partial |
| `pathology.blood_request.*` / `pathology.blood_result.*` | CRM activity | Current |
| `pathology.ai_interpretation.*` | CRM activity | Current |
| Timeline kinds from FI ingest | `fi_timeline_events` | Current |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `lead.converted` | LeadFlow | Create/link `fi_persons`, `fi_patients` |
| `hli.intake.submitted` | HLI producer | Global resolve + timeline |
| `hli.document.uploaded` | HLI producer | Media assets, signals |
| `booking.completed` | ClinicOS | Timeline, post-consult flows |
| `surgery.completed` | SurgeryOS | Case status, post-op tracking |

## Database Tables

- `fi_persons`, `fi_person_roles`, `fi_person_source_ids`
- `fi_patients`, `fi_patient_clinical_details`, `fi_patient_clinical_scales`
- `fi_patient_source_ids`, `fi_patient_images`
- `fi_cases`, `fi_case_procedures`, `fi_case_surgery_plans`, `fi_case_post_op_tracking`
- `fi_pathology_requests`, `fi_pathology_ai_interpretations`
- `fi_medication_*` (medication OS tables)
- `fi_timeline_events`
- `fi_network_subjects` — Clinical Intelligence Network foundation (Stage 6+)

## External Integrations

- **HLI** — intake and document events via `POST /api/fi/events`
- **Timely** — patient external ID mapping
- **Pharmacy send** — e-prescribing integrations

## Security Boundaries

- Strict tenant RLS on all patient tables.
- Clinical data: authenticated tenant members only; PHI never in client-side logs.
- Patient portal routes: separate gate from FI Admin shell.
- Soft-delete guards on cases (`fi_cases_soft_delete_guard`).

## Ownership Rules

| Data | System of record |
|------|------------------|
| FI patient record | PatientOS (FI Supabase) |
| HLI portal patient | HLI (FI receives events only) |
| Clinical images | PatientOS (`fi_patient_images`) |
| Canonical global person | Platform Core with PatientOS projection |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Duplicate person on conversion | Split patient record | Source ID mapping tables; merge tooling |
| Timeline gap after ingest failure | Incomplete patient view | Replay from `fi_events` |
| Image classification failure | Missing HLI tags | Stage 8A fallback + manual protocol |
| Case/patient unlink | Orphan clinical data | FK constraints + conversion atomicity |
