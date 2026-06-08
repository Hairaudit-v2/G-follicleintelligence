# DoctorOS 1A — Prescription catalogue & patient records

## Database

Migration: `supabase/migrations/20260627120001_fi_prescribing.sql`

- **`fi_medication_catalogue`** — tenant-scoped rows aligned to compound pricing list **sections**: common / less common oral and topical, plus **delivery fees**. Fields: `category`, `medication_name`, `form_type` (`capsule` \| `solution` \| `foam` \| `delivery`), `quantity_label`, `base_price`, `active`, `pharmacy_notes`, `requires_doctor_approval`.
- **`fi_patient_prescriptions`** — `patient_id`, `doctor_id` (`fi_staff`), optional `case_id` (`fi_cases`), workflow `status`, logistics fields, `signed_at`, `sent_at` (for later stages), **`ready_for_pharmacy_at`** for internal “ready to send” without changing status away from `signed`.
- **`fi_prescription_items`** — catalogue link + snapshots, `dose_instructions`, `repeats_instructions`, `reorder_rule`, `sort_order`.
- **`fi_prescription_status_events`** — append-only audit; `to_status` may include `ready_for_pharmacy` for queue events while the prescription row stays `signed`.

Seeding: default catalogue rows are inserted **once per tenant** that has **zero** catalogue rows (so existing curated rows are not duplicated).

## UI / routes

| Surface | Location |
|--------|-----------|
| Patient profile | Tab **Prescriptions** (`?tab=prescriptions`) |
| Case detail | Section **Prescriptions** (anchor `#case-prescriptions`) |
| Doctor workspace | `/fi-admin/[tenantId]/prescriptions` (+ FI OS sidebar **Prescriptions**); compose at `/prescriptions/new?patientId=&caseId=` |

## Server actions

`lib/actions/fi-prescribing-actions.ts` — tenant `fi_users` membership required (`requireFiPrescribingActor`). Operations: save draft (create/update + replace line items), sign, mark ready for pharmacy, cancel (blocks sent/dispensed/posted).

## Pricing source

The repository does not include the uploaded compound spreadsheet; the migration seeds **illustrative** names and prices following the requested **category structure**. Replace or extend rows per tenant in `fi_medication_catalogue` as pharmacy contracts dictate.
