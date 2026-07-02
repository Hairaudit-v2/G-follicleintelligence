# DoctorOS — Private Rx v1 (design)

**Status:** Design only — no implementation in this document.  
**Related:** [Private Rx support audit](../audits/private-rx-support-audit.md) · [DoctorOS 1A — Prescribing](./doctoros-1a-prescribing.md) · [MedicationOS v1](./medication-os-v1.md)

---

## 1. Purpose

1. **Private prescription** — A patient-facing document the patient can **print or download** and present to **any** licensed pharmacy able to dispense the prescribed items (subject to local law). DoctorOS remains the **system of record** for authoring, signing, issuing, and auditing that prescription.

2. **Separation from compound workflow** — The existing **compound pharmacy order** path (`renderPharmacyOrderPdfBytes`, `fi_pharmacy_transmissions`, “COMPOUND PHARMACY ORDER” PDF) stays **unchanged in intent**. Private Rx uses a **different** dispensing mode, **different** PDF renderer, and **must not** reuse the compound order layout or imply a selected compound partner unless the product explicitly adds that later.

3. **Prescribing authority** — Only **DoctorOS** (tenant clinicians via `requireFiPrescribingActor` and equivalent gates) authorises creation, amendment before issue, signing, issuance to patient, and revocation. Patient portal is **read/download** only where enabled.

4. **MedicationOS** — Therapy plans and events may **reference** `prescription_id` / plan item links per [MedicationOS v1](./medication-os-v1.md). MedicationOS does **not** replace legal prescription rows; it mirrors and contextualises care.

---

## 2. Prescription modes (`dispensing_mode`)

A single column on `fi_patient_prescriptions` (see §3) classifies how the prescription is intended to be fulfilled. **Exactly one mode** applies per prescription row for v1 (no hybrid send in v1).

| Mode | Meaning | Primary artefacts |
|------|---------|-------------------|
| **`compound_pharmacy_order`** | Default / legacy behaviour: order transmitted or exported to a **tenant-configured compound partner** (`fi_compound_pharmacies`, `fi_pharmacy_transmissions`). | Pharmacy order PDF, transmission log, existing status transitions. |
| **`private_patient_rx`** | Patient-presented private prescription: **Private Rx PDF**, patient download (optional), validity window. | `renderPrivateRxPdfBytes`, patient portal (if enabled). |
| **`internal_clinic_supply`** | Reserved: medication supplied or administered **within the clinic** without a patient-presented pharmacy script (e.g. in-office use, samples, IV in facility). **Not implemented in v1** beyond schema enum + UI placeholder or hidden. | Future: internal dispensing log, no public pharmacy PDF. |

**Rules v1:**

- On **create**, default `dispensing_mode` for new prescriptions = `compound_pharmacy_order` (backward compatible) **or** tenant default (product choice); document in migration notes.
- **`private_patient_rx`**: hide or disable **Pharmacy send** panel that targets `fi_pharmacy_transmissions` (or block server-side if mode is private).
- **`compound_pharmacy_order`**: hide **Issue Private Rx** / patient private PDF issuance actions **or** show disabled with explanation (no mixed mode v1).

---

## 3. Schema changes (minimal)

### 3.1 `fi_patient_prescriptions` — recommended columns

| Column | Type | Notes |
|--------|------|--------|
| **`dispensing_mode`** | `text` NOT NULL, CHECK in (`compound_pharmacy_order`, `private_patient_rx`, `internal_clinic_supply`) | Default `compound_pharmacy_order`. Drives UI and allowed transitions. |
| **`issued_to_patient_at`** | `timestamptz` nullable | Set when clinician completes **Issue to patient** (patient may download only after this if policy = post-issue only). |
| **`private_rx_pdf_generated_at`** | `timestamptz` nullable | Last successful build of private PDF (preview or issue); supports “regenerate” audit. |
| **`private_rx_expires_at`** | `timestamptz` nullable | Legal/clinical validity end for **private** presentation; drives **expired** state (see §4). |
| **`private_rx_number`** | `text` nullable | Human-readable display id (e.g. tenant prefix + sequence); **not** a national script number unless you integrate one later. Unique per tenant optional UNIQUE constraint. |
| **`prescriber_signature_asset_id`** | `uuid` nullable | FK to a future **`fi_assets`** (or storage object table) when image/Typed signature file exists. |
| **`prescriber_signature_metadata`** | `jsonb` not null default `{}` | v1 fallback: `{ "method": "typed_name" \| "drawn" \| "none", "typed_name": "...", "captured_at": "ISO" }` without binary asset. |
| **`patient_download_enabled`** | `boolean` not null default `false` | Master switch for portal visibility/download. |
| **`patient_download_expires_at`** | `timestamptz` nullable | Optional **narrower** window than `private_rx_expires_at` (e.g. stop downloads after 30 days while script valid longer — product/legal choice). Null = same as policy on `private_rx_expires_at` or no extra gate. |

**Existing columns reused for private PDF where appropriate:**

- **`signed_at`** — Prescriber sign time (unchanged).
- **`doctor_id`** — Prescriber (`fi_staff`).
- **`patient_id`**, **`case_id`**, **`clinical_notes`** — Context; clinical notes may appear on PDF per config (jurisdiction).
- **Line repeats** — Continue to use **`fi_prescription_items`**: `repeats_instructions`, `quantity_label`, `dose_instructions`; header `repeats_allowed` / `repeat_limit` remain **portal reorder** semantics — do **not** overload as legal “NHS repeat” without legal review. Private PDF should print **line-level** repeat text explicitly.

### 3.2 `fi_prescription_items` — item-level additions

**Default v1:** **No new columns required.** Snapshot names, quantities, and instructions already live on items.

**Optional later** (only if legal needs per-line validity or line-level revoke):

- `private_rx_line_superseded_at` timestamptz nullable  
- `private_rx_repeat_authorised` int nullable (authorised dispensings) — **non-goal for v1** unless jurisdiction mandates.

---

## 4. Status model

Today’s row **`status`** drives workflow. Private Rx v1 **extends** the allowed set and clarifies semantics. Implementation should use a **single** `status` column plus **`dispensing_mode`** and timestamps (`issued_to_patient_at`, `private_rx_expires_at`) to avoid contradictory state.

| Status | Meaning |
|--------|---------|
| **`draft`** | Unsigned; editable lines and header (subject to existing rules). |
| **`signed`** | Prescriber signed (`signed_at` set). For **`private_patient_rx`**, next step is **Issue to patient** (sets `issued_to_patient_at`, may transition to `issued_to_patient`). For **compound**, may proceed to pharmacy send / ready queue. |
| **`issued_to_patient`** | **Private mode only:** prescription issued to patient for self-presentation; downloads allowed if `patient_download_enabled`. Terminal for “active script” until fulfilled or expired/cancelled. |
| **`sent_to_pharmacy`** | **Compound mode only:** existing meaning — transmission completed to partner (`sent_at`, `pharmacy_id` as today). **Invalid** transition from pure `private_patient_rx` in v1. |
| **`fulfilled`** | **v1 recommendation:** use as **optional** unified “dispensing completed” terminal for **private** path when staff records completion OR patient confirms pickup (manual v1). **Compound** path may keep **`dispensed`** / **`posted`** for backward compatibility **or** map UI label “Fulfilled” to `dispensed` until a later migration merges labels. Document chosen mapping in implementation ticket. |
| **`cancelled`** | Voided; no downloads; pharmacy send blocked. |
| **`expired`** | Validity ended (`private_rx_expires_at` < now) without fulfilment; **read-only**; downloads off. **Alternative:** keep status `issued_to_patient` and compute **expired** in UI from date — prefer explicit **`expired`** status if batch job or DB check constraint clarity matters. |

**Legacy statuses** (`dispensed`, `posted`): retain for **compound** workflows per existing migrations; Private Rx v1 should not require patients to understand them. Private path prefers **`fulfilled`** or **`cancelled`** / **`expired`**.

**State machine sketch (private_patient_rx):**

`draft` → `signed` → `issued_to_patient` → (`fulfilled` | `expired` | `cancelled`)

**State machine sketch (compound_pharmacy_order):**

Unchanged from today: `draft` → `signed` → (`sent_to_pharmacy` → … → `dispensed` / `posted`) or `cancelled`.

---

## 5. PDF — `renderPrivateRxPdfBytes`

**New module** (conceptual path e.g. `privateRxPdf.server.ts`). **Do not** call `renderPharmacyOrderPdfBytes` or share the “COMPOUND PHARMACY ORDER” template.

### 5.1 Title and framing

- Prominent title: **“Private prescription”** (or tenant-configurable string via `fi_tenant_settings` / branding JSON, e.g. `private_rx_pdf_title`).
- Subtitle/locale line from **config**, not hardcoded to Australia.

### 5.2 Required content blocks

1. **Clinic details** — From effective branding / tenant registry: legal entity name, address, phone, **ABN or local equivalent only if configured** (nullable config keys per jurisdiction).
2. **Prescriber details** — Name, role, **registration numbers** (GMC, AHPRA, etc.) sourced from **`fi_staff`** extended fields or `prescriber_signature_metadata` / future staff credentials table — **all optional strings** filled from config, not AU-only assumptions.
3. **Patient details** — Full name, DOB if available on `fi_persons` / patient record, address optional; align with minimum legal set from counsel.
4. **Medication items** — For each `fi_prescription_items` row: product name, form, **quantity** (`quantity_label`), **dose directions** (`dose_instructions`).
5. **Repeats** — Line `repeats_instructions` + header repeat flags if policy dictates printing “authorised repeats” vs “reorder portal” text — default: print **line repeats text** only for private PDF to avoid confusing pharmacy with internal portal semantics.
6. **Issue date** — `signed_at` or dedicated `issued_to_patient_at` per product rule (recommend **issue date** = date of `issued_to_patient_at` when set, else `signed_at` for preview).
7. **Expiry / validity** — `private_rx_expires_at` printed clearly; if null, print “As per prescriber” or hide per **tenant config** `private_rx_show_expiry_when_null`.
8. **Prescriber signature** — Image from `prescriber_signature_asset_id` **or** typed name + timestamp from `prescriber_signature_metadata` **or** blank with warning if unsigned method (blocked at issue time ideally).
9. **Private Rx number** — `private_rx_number` when assigned.
10. **Disclaimers** — Footer block: configurable multi-paragraph **`private_rx_pdf_disclaimers`** (tenant or global), plus static FI platform line: “Generated in Follicle Intelligence — verify authenticity.”

### 5.3 Storage

v1: **Generate on demand** (same pattern as compound PDF); optional future: store PDF hash + S3 key for tamper-evidence.

---

## 6. Access model

### 6.1 Doctor / admin (FI Admin + DoctorOS)

- **Preview** private PDF before issue (server action + short-lived or session-gated URL).
- **Generate / re-generate** after sign (updates `private_rx_pdf_generated_at`; audit event).
- **Issue to patient** — Sets `issued_to_patient_at`, optionally transitions status to `issued_to_patient`, sets `patient_download_enabled` per policy, computes `private_rx_expires_at` from tenant rules (e.g. sign + N months **configurable**).
- **Revoke** — Clears download flags and/or sets `cancelled`; audit `private_rx_revoked`.

All mutations via **service role + `requireFiPrescribingActor`** (or stricter role if introduced).

### 6.2 Patient portal

- **Scope:** Authenticated **patient identity** bound to `fi_patients.id` for the tenant; server verifies session patient matches `fi_patient_prescriptions.patient_id`.
- **Conditions for download:** `dispensing_mode = private_patient_rx` AND `patient_download_enabled` AND `issued_to_patient_at` not null AND status in (`issued_to_patient`, optionally `signed` if product allows pre-issue — **default: require `issued_to_patient`**) AND not `cancelled` AND not expired (by status or `private_rx_expires_at`) AND (`patient_download_expires_at` is null or in future).
- **Logging:** Every successful PDF byte response appends **`private_rx_downloaded_by_patient`** audit (see §7) with IP/user-agent hash optional in `detail`.

**No** reuse of `pharmacy-order-pdf` CRM route for patients; **new** route e.g. `GET /api/patient/.../private-rx.pdf` with patient JWT/session middleware.

---

## 7. Audit trail

### 7.1 Recommendation: extend `fi_prescription_status_events`

Add nullable columns (migration):

- **`event_kind`** `text` nullable — when null, row is legacy **workflow** transition (`to_status` drives meaning).  
- **`detail`** `jsonb` not null default `'{}'` — structured payload (IP hash, `pdf_version`, `regenerated`, etc.).

**Workflow transitions** continue to set `from_status` / `to_status` as today.

**Non-status-changing events** (e.g. patient download): set `event_kind` to one of:

| `event_kind` | When |
|--------------|------|
| `private_rx_generated` | Successful PDF generation (preview or issue). |
| `private_rx_issued_to_patient` | Issue action completed. |
| `private_rx_downloaded_by_patient` | Patient downloaded PDF. |
| `private_rx_revoked` | Staff revoked portal / voided private issuance. |
| `private_rx_expired` | System or job marked expired. |

For these, **`to_status`** = current prescription `status` after the action (or previous status for idempotency — document one convention). **`from_status`** may equal `to_status` when the event is purely auditable.

**CHECK constraint migration:** extend `fi_prescription_status_events` `to_status` / `from_status` checks to include **`issued_to_patient`**, **`fulfilled`**, **`expired`** if those are stored as statuses.

### 7.2 Alternative

If altering `fi_prescription_status_events` is undesirable, add **`fi_prescription_private_rx_audit`** (append-only) with `event_kind` + `detail` + FK `prescription_id`. Prefer **single table** unless event volume forces split.

---

## 8. Timeline integration (`fi_timeline_events`)

Mirror **high-signal** private Rx events for foundation timeline / Twin (same philosophy as [MedicationOS §6](./medication-os-v1.md)).

Suggested `event_kind` values (namespace `prescription.`):

| Trigger | `event_kind` | Example title | `detail` keys |
|---------|--------------|---------------|---------------|
| Issued to patient | `prescription.private_rx_issued` | Private prescription issued | `prescription_id`, `private_rx_number`, `expires_at` |
| Patient downloaded | `prescription.private_rx_downloaded` | Prescription downloaded (optional) | `prescription_id`, `at` — **staff-only visibility** flag in `detail` if patient privacy policy hides from shared case feed |
| Cancelled | `prescription.cancelled` | Prescription cancelled | `prescription_id`, `reason` |
| Expired | `prescription.private_rx_expired` | Private prescription expired | `prescription_id` |

**Rules:**

- Insert when `case_id` present **or** patient-only timeline policy allows (align with MedicationOS dedupe guidance).
- **Staff-only download events:** if showing “patient downloaded” in a shared case timeline is sensitive, set `detail.visibility = "staff"` and filter in Twin/case UI.

---

## 9. MedicationOS integration

- **`fi_patient_therapy_plan_items.prescription_id`** — May point to the same `fi_patient_prescriptions` row when a plan line is fulfilled by issuing that Rx (compound or private). No schema change required for v1 if FK already nullable.

- **Therapy events (`fi_patient_therapy_events`):**
  - On **private issue**, insert **`prescription_linked`** (extend `event_type` CHECK in a future MedicationOS migration) **or** reuse an existing type with `detail.purpose = "private_rx_issue"` — product to pick one vocabulary and keep **append-only**.
  - **`therapy_started`:** **Do not** auto-fire on issue alone. Create only when **clinician confirms** therapy commencement (per MedicationOS clinical meaning) or when separate UI action records start.

- **Dual track reminder:** Prescriptions remain authoritative for **legal dispensing**; MedicationOS events are **clinical narrative**.

---

## 10. UI changes

### 10.1 DoctorOS / FI Admin prescribing

- **Mode selector** at draft time: `compound_pharmacy_order` vs `private_patient_rx` (immutable or locked after sign — product choice; recommend **lock after sign**).
- **“Issue Private Rx”** button — visible when `dispensing_mode = private_patient_rx` and `status = signed` (or `issued_to_patient` for re-issue flow if allowed).
- **PDF preview / download** — staff-only; opens new renderer output.
- **Status badge** — Show `issued_to_patient`, `expired`, etc.; hide compound badges when mode is private.

### 10.2 Patient portal

- New **“Prescriptions”** subsection (or extend **My medications**) listing **private** issued scripts with **status**, **expiry**, **private_rx_number**.
- **Download Private Rx** — enabled per §6; show countdown if `patient_download_expires_at` set.
- Clear copy: “Take this prescription to a pharmacy of your choice” (localisable).

---

## 11. Compliance / regulatory notes

1. **Jurisdiction** — PDF field requirements, retention, and whether **private_rx_number** must follow a national format are **not** decided in code. Store **tenant-level config** (JSON or settings table): registration field labels, optional ABN line, disclaimer paragraphs, default validity duration.
2. **No Australia-only hardcoding** — All regulatory strings and numbers come from **config + staff profile**, with empty = omit line on PDF.
3. **Clinical / legal sign-off** — **Required** before production: template text, signature method adequacy, data retention for audit logs, patient access logging, and whether `repeats_instructions` satisfies local pharmacy regulation.
4. **Controlled drugs** — v1 **non-goal** (see §13); if a catalogue item is flagged controlled in future, **block** private issue or show warning — placeholder `fi_medication_catalogue` or item metadata flag **out of scope** unless added as empty stub.

---

## 12. Rollout plan

| Phase | Deliverable |
|-------|-------------|
| **1** | This design + legal/compliance review of PDF fields and statuses. |
| **2** | Schema: `dispensing_mode`, private columns, status CHECK updates, `fi_prescription_status_events` extensions. |
| **3** | `renderPrivateRxPdfBytes` + staff preview API + tenant config keys. |
| **4** | DoctorOS issue flow, `private_rx_number` sequencing (per-tenant counter table optional), revoke. |
| **5** | Audit: `event_kind` + timeline mirroring for §8 events. |
| **6** | Patient portal download route + UI + download audit. |
| **7** | MedicationOS: optional `prescription_linked` event on issue; docs for plan item FK. |

Feature flag: **`doctoros_private_rx_v1`** per tenant until stable.

---

## 13. Non-goals v1

- **No** electronic prescribing network integration (eRx, NHS EPS, etc.).
- **No** pharmacy marketplace or routing.
- **No** automatic dispensing confirmation from pharmacies.
- **No** drug–drug interaction engine.
- **No** full controlled-drug workflow — at most **placeholder** metadata flags for future; private issue for controlled items **blocked** or **explicitly out of scope** until compliance design exists.

---

## Document history

| Date | Author | Note |
|------|--------|------|
| 2026-06-12 | FI design | Initial Private Rx v1 design from audit + DoctorOS 1A + MedicationOS v1. |
