# Audit: DoctorOS prescribing — Private Rx (patient-presented) support

**Date:** 2026-06-12  
**Scope:** Whether Follicle Intelligence OS currently supports a **patient-facing private prescription** that can be **printed or downloaded** and taken to **any** pharmacy (as distinct from **electronically transmitted / compound-partner** workflows).

**Verdict:** **Not supported as a first-class product.** The stack is optimised for **internal authoring** and **compound pharmacy orders** (directory + transmission). A clinician could manually download the existing **pharmacy order PDF** after choosing a compound partner, but that artefact is **not** a general-purpose private Rx, is **not** exposed to patients, and the data model does **not** distinguish private vs transmitted dispensing.

---

## 1. `fi_patient_prescriptions` and related tables

### Source of truth

- Base schema: `supabase/migrations/20260627120002_fi_prescribing.sql`
- Pharmacy linkage + transmissions: `supabase/migrations/20260629120002_fi_pharmacy_send.sql`
- Reorder / repeat portal fields on header: `supabase/migrations/20260701120001_fi_medication_reorder_portal.sql`

### Prescription type / category

- **No column** for prescription class (e.g. private vs EPS vs compound-only). Workflow is implied by **`status`** (`draft`, `signed`, `sent_to_pharmacy`, `dispensed`, `posted`, `cancelled`) and optional **`pharmacy_id` / `pharmacy_name`** after send.
- **Catalogue** (`fi_medication_catalogue`) uses **`category`** for formulary groupings (`common_oral`, `delivery_fees`, etc.), not legal prescription type.

### Private vs pharmacy-transmitted

- **No explicit flag** (e.g. `dispensing_mode`, `is_private_rx`, `transmission_channel`).
- **`fi_pharmacy_transmissions`** records outbound attempts (`email`, `api`, `manual_export`). That is a **transmission log**, not a “private only” mode.
- **`sent_at`** + status `sent_to_pharmacy` indicate the **compound send** path, not “patient will self-present”.

### Prescriber details

- Header has **`doctor_id`** → `fi_staff` (required). Server loaders resolve **`full_name`** and **`staff_role`** for PDFs and payloads.
- **No** persisted regulatory identifiers on the prescription (e.g. GMC/GDC number, prescriber address, PIN) in this table set — only what exists on **`fi_staff`** / branding elsewhere (not audited in depth here).

### Patient details

- **`patient_id`** → `fi_patients`; PDF/payload builders resolve a **display label and email** from linked **`fi_persons.metadata`** (via `pharmacyOrderPayload.server.ts`).
- **No** dedicated patient address / DOB block on the prescription row beyond **`patient_shipping_address`** (logistics for compound delivery).

### Medication items

- **`fi_prescription_items`**: `medication_name`, `form_type`, `quantity_label`, `dose_instructions`, optional `repeats_instructions`, `reorder_rule`, `repeat_rules_prescriber_confirmed`, optional `catalogue_id`.

### Repeats

- **Header:** `repeats_allowed`, `repeat_limit`, `reorders_used`, `reorder_valid_from`, `reorder_valid_until`, `reorder_review_required`, fee fields (`patient_reorder_fee_pence`, `reorder_fee_payment_required`) — oriented to **portal reorder**, not legal “NHS/private repeat” encoding on a paper Rx.
- **Lines:** `repeats_instructions`, `reorder_rule` + prescriber confirmation gate for pharmacy send.

### Validity / expiry

- **No** dedicated “prescription legally valid until” field on `fi_patient_prescriptions`.
- **`reorder_valid_from` / `reorder_valid_until`** constrain **patient reorder eligibility**, not a general dispensing validity window for a private paper Rx.

### Signatures

- **`signed_at`** timestamp only when status moves to `signed`. **No** image signature, **no** advanced electronic signature metadata, **no** separate “signing clinician” if different from `doctor_id`.

### PDF storage vs generated route

- **No** BLOB/storage column for prescription PDFs on `fi_patient_prescriptions` or transmissions (snapshots are **JSON** in `fi_pharmacy_transmissions.payload_snapshot`).
- **Generation:** `src/lib/prescribing/pharmacyOrderPdf.server.ts` (`renderPharmacyOrderPdfBytes`) using **pdf-lib**, on demand.
- **Download route (staff / CRM):** `app/api/tenants/[tenantId]/patients/[patientId]/prescriptions/[prescriptionId]/pharmacy-order-pdf/route.ts`  
  - Requires query **`pharmacyId`** (live build against a **compound** directory row) or **`transmissionId`** (rebuild from stored snapshot).  
  - Document title in the PDF is **“COMPOUND PHARMACY ORDER”** — explicitly partner-oriented, not a neutral “private prescription” form.

---

## 2. Actions, loaders, and server modules

| Area | Role re Private Rx |
|------|---------------------|
| `lib/actions/fi-prescribing-actions.ts` | Draft/save, sign (`signed_at`), mark ready for pharmacy, cancel. **No** branch for private dispensing or patient PDF issuance. |
| `lib/actions/fi-pharmacy-transmission-actions.ts` | Creates `fi_pharmacy_transmissions`, sends email+PDF to **compound** contact, API JSON, or manual export attestation. Updates Rx to `sent_to_pharmacy` when appropriate. **Private “any pharmacy” path absent.** |
| `src/lib/prescribing/fiPrescribingLoaders.server.ts` | CRUD read patterns for admin/DoctorOS; **no** patient-session variant. |
| `src/lib/prescribing/pharmacyOrderPayload.server.ts` | Builds **pharmacy order** snapshot + PDF context (always includes **selected compound pharmacy** block). |
| `src/lib/prescribing/pharmacyOrderPdf.server.ts` | Renders **compound order** layout (clinic banner, patient, shipping, **pharmacy**, prescriber, lines, disclaimer). |
| `src/lib/prescribing/fiPrescribingAccess.server.ts` | **`requireFiPrescribingActor`** — authenticated **tenant `fi_users`**, not patient portal users. |

---

## 3. UI: prescribing, DoctorOS workspace, case/patient surfaces

- **Editor + pharmacy send:** `src/components/fi-admin/prescribing/PrescriptionEditorClient.tsx` integrates **`PrescriptionPharmacySendPanel`** (compound methods + PDF preview link).
- **Pharmacy panel:** `PrescriptionPharmacySendPanel.tsx` builds the PDF URL under **`/api/tenants/.../pharmacy-order-pdf?pharmacyId=...`** (FI Admin / CRM gate — see route).
- **Case list:** `CasePrescriptionsSection.tsx` — lists case prescriptions, links to FI Admin prescription editor; copy still describes **internal / Stage 1** behaviour.
- **Workspace:** `src/lib/doctorOs/doctorWorkspaceLoader.server.ts` surfaces **draft** prescription queues and **pharmacy transmission** failures/pending — **DoctorOS operational**, not patient PDF delivery.
- **Patient detail tab** wiring exists (`PatientDetailPageView` / `patientDetailTabs`) for a prescriptions tab in admin; still **staff-facing**.

**No UI** for “issue private Rx” or “download for patient” as a distinct workflow.

---

## 4. Patient portal exposure

- **Component:** `src/components/patient-portal/PatientMedicationsPortalClient.tsx`
- **Behaviour:** Reorder flows, eligibility text, and a minimal **“Previous prescriptions”** list (status, dates, repeat counters). **No links** to PDFs, **no** full prescription document, **no** download.
- **Data:** `src/lib/medicationReorder/medicationReorderLoaders.server.ts` (`loadMedicationPortalLines`) loads prescriptions + items for the logged-in patient context — but **only** to drive reorder UI, not legal documents.
- **API:** The **`pharmacy-order-pdf`** route uses **`assertCrmTenantReadAllowed`** (admin/CRM access model). It is **not** a patient-authenticated prescription download endpoint.

---

## 5. Answers

### Is Private Rx already supported?

**No** — not as an intentional, patient-presented, pharmacy-agnostic prescription product.

### What exists today (partial reuse)?

- A **single prescription record** with patient, assigned prescriber (`fi_staff`), line items, signing timestamp, and repeat/reorder metadata suitable for **internal** and **compound partner** operations.
- **On-demand PDF** generation and **email/API/manual** transmission aimed at **`fi_compound_pharmacies`**.
- **Patient portal** visibility of prescription **metadata** for **reorders** only.

### What is missing for true Private Rx v1?

1. **Product/data model:** Explicit **`dispensing_mode`** (or equivalent): `patient_presented` vs `compound_transmit` (and rules for status transitions).
2. **Document:** A **patient-private Rx** PDF template (jurisdiction-specific content: prescriber registration, clinic address, patient identifiers, validity, legal wording) — **separate** from “COMPOUND PHARMACY ORDER”.
3. **Optional:** Regulatory / identity fields on staff or prescription as required by counsel.
4. **Patient access:** Authenticated **patient** route (or portal action) to **view/download** the private Rx PDF, with RLS or service-role checks that **only** expose that patient’s data.
5. **Workflow:** Authoring UI toggle, validation (e.g. private Rx may not require `pharmacy_id`), and analytics/audit events distinct from `fi_pharmacy_transmissions`.
6. **Storage strategy:** Continue generate-on-read vs store immutable PDF + hash — product/legal decision.

---

## 6. Recommended implementation plan — DoctorOS Private Rx v1

1. **Discovery / compliance:** Define the minimum legal fields for the jurisdictions you operate in (UK private Rx vs other markets). Freeze a **v1 PDF field list** before schema work.
2. **Schema (minimal):** Add `dispensing_mode` (or `prescription_kind`) on `fi_patient_prescriptions` with values such as `compound_partner` | `patient_private` (names TBD). Optionally `private_rx_pdf_version` or `issued_at` if you version templates.
3. **PDF module:** Add `renderPrivatePrescriptionPdfBytes` (or parameterise layout) **without** reusing the compound-order header/body verbatim. Reuse patient + prescriber resolution from `pharmacyOrderPayload.server.ts` patterns where appropriate.
4. **API:** New route e.g. `.../private-prescription-pdf` gated by **patient session** OR staff “preview as patient”; **do not** widen `pharmacy-order-pdf` semantics.
5. **RLS / security:** Ensure patient-role policies can **select** only their prescriptions (or use server-only service role + explicit checks mirroring reorder loaders).
6. **UI — DoctorOS:** On `PrescriptionEditorClient`, when mode is private: hide or disable compound send panel; add **“Issue / Download private Rx”** for signed state; optional email-to-patient (out of scope if v1 is download-only).
7. **UI — Portal:** In `PatientMedicationsPortalClient`, add download for eligible signed private Rxs; keep compound transmission **staff-only**.
8. **Status model:** Decide whether `patient_private` avoids `sent_to_pharmacy` entirely or uses a new status like `issued_to_patient` — avoid overloading `sent_to_pharmacy`.
9. **QA:** Snapshot tests for PDF field presence; integration test for patient route authorization.

---

## 7. File index (quick reference)

| Path | Note |
|------|------|
| `supabase/migrations/20260627120002_fi_prescribing.sql` | Core `fi_patient_prescriptions` / items / events |
| `supabase/migrations/20260629120002_fi_pharmacy_send.sql` | Compound pharmacies + `fi_pharmacy_transmissions` |
| `supabase/migrations/20260701120001_fi_medication_reorder_portal.sql` | Header repeat/reorder columns |
| `lib/actions/fi-prescribing-actions.ts` | Prescribing mutations |
| `lib/actions/fi-pharmacy-transmission-actions.ts` | Pharmacy send + PDF attachment |
| `src/lib/prescribing/pharmacyOrderPdf.server.ts` | PDF rendering |
| `src/lib/prescribing/pharmacyOrderPayload.server.ts` | Payload + PDF context |
| `app/api/tenants/.../pharmacy-order-pdf/route.ts` | Staff PDF download |
| `src/components/fi-admin/prescribing/PrescriptionPharmacySendPanel.tsx` | PDF links in admin |
| `src/components/patient-portal/PatientMedicationsPortalClient.tsx` | Portal — no Rx PDF |

---

*This document is an audit only; no application code was changed for its production.*
