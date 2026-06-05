# ConsultationOS — architecture and data model design (Stage 3A)

**Status:** design only — Stage 3A. Do not treat as an implementation mandate until reviewed and sequenced with CRM, cases, and patient foundations.

**Scope of this document:** conceptual architecture, lifecycle, record shape, field typing (structured vs narrative vs AI-assisted), relationships, future live-consultation concepts, and phased MVP (3B–3D). **No** database tables, migrations, routes, components, server actions, or code changes are implied by this file alone.

**Note on numbering:** This document uses the `19-` prefix alongside other `19-` design files in this folder. Rename or re-index when the design catalogue is consolidated.

---

## 1. Vision

### 1.1 Position in the Follicle Intelligence funnel

ConsultationOS sits in the **clinical-commercial bridge** of the patient journey:

```text
Lead
  ↓
Consultation          ← ConsultationOS (this layer)
  ↓
Treatment Plan
  ↓
Quote
  ↓
Case
  ↓
Surgery
  ↓
Outcome
```

**Lead** captures intent, source, and pipeline mechanics. **Consultation** captures *clinical reasoning*, donor and pattern assessment, suitability, and the narrative that justifies a plan. **Treatment plan** and **quote** translate that reasoning into structured offerings and pricing. **Case** operationalises commitment (scheduling, consents, pre-op, surgery, post-op). **Outcome** closes the loop for quality, audit, and longitudinal care.

ConsultationOS is responsible for the **consultation artefact**: a durable, queryable record of *what was observed, inferred, and recommended* before money and theatre time are committed.

### 1.2 Clinical intelligence layer, not a CRM note

A CRM note is typically **unstructured**, **activity-scoped**, and optimised for *sales follow-up* (who said what, when to call back). ConsultationOS is different:

| Dimension | CRM note (anti-pattern for this domain) | ConsultationOS |
| --- | --- | --- |
| Primary purpose | Relationship and task tracking | Clinical assessment + defensible recommendation path |
| Structure | Free text first | **Structured assessments** (classifications, grades, inventories) with narrative supplements |
| Reuse | Hard to aggregate or compare | Supports reporting, training, QA, and AI on **consistent fields** |
| Downstream | Loosely coupled to revenue | **Explicit linkage** to treatment plan, quote, graft estimates, and case conversion |
| Risk | Informal phrasing dominates | Mix of structured data + **audit-friendly** narrative and provenance where AI assists |

ConsultationOS therefore **complements** CRM (e.g. lead context, referral source, owner) but **does not subsume** clinical documentation. It is the system of record for the **consultation episode** as a first-class entity—not a comment thread on a lead.

---

## 2. Consultation lifecycle

Lifecycle states describe **business and clinical progression** of a single consultation record. They are not identical to CRM lead stages; they may **mirror** them in places but must remain definable on the consultation itself.

| State | Meaning |
| --- | --- |
| **Draft** | Consultation created but incomplete; not yet presented as a finished clinical encounter. Edits are expected; may be missing required fields for downstream steps. |
| **In progress** | Active consultation: data entry, imaging review, or live encounter in progress. Still editable; may already link to a lead or person. |
| **Completed** | Clinical encounter and documentation considered complete from the provider’s perspective: assessments and recommendations captured to a defined minimum. Unlocks or aligns with quoting workflows (policy-dependent). |
| **Quoted** | At least one **quote** (or formal fee proposal) has been issued from this consultation context. Consultation remains the anchor for *what* was quoted. |
| **Accepted** | Patient (or proxy) has accepted a defined offer linked to this consultation (e.g. signed proposal, deposit, or contractual acceptance—exact rules are product/policy). |
| **Converted to case** | A **case** has been created (or linked) with provenance from this consultation; clinical ops hand off from “pre-commitment” to “operational case.” |
| **Archived** | No longer active for daily work (lost, duplicate, expired without conversion, or superseded). Read-only or restricted edit; retained for audit and analytics. |

**Design notes (non-binding):**

- **Completed → Quoted** may be skipped in some clinics (quote from draft) — architecture should allow **policy** or **tenant configuration** later, not hard-coded assumptions in v1.
- **Accepted** vs **Converted to case** may collapse in some implementations; keeping both supports **deposit accepted** before **case opened** scenarios.
- Transitions should eventually support an **audit trail** (who changed state, when, from where).

---

## 3. Consultation record structure

The following is a **logical model** for what a consultation record contains. Physical tables and JSON shapes are **out of scope** for Stage 3A.

### 3.1 Patient information

| Area | Content |
| --- | --- |
| Identity / demographics | Name, date of birth |
| Contact | Phone, email, preferred channel, consent flags as required by jurisdiction |
| Referral | Referral source (structured where possible), referrer detail |
| Consultant | Attributable clinician(s) / staff conducting or signing the consultation |

**Cross-links:** May reference an existing **person** or **patient** record when the foundation already knows them; for greenfield leads, enough patient information may exist only on the consultation until conversion.

### 3.2 Hair loss assessment

| Area | Content |
| --- | --- |
| Pattern | Pattern classification (e.g. Norwood/Ludwig or clinic’s taxonomy) |
| Grade | Severity grade consistent with chosen classification |
| Duration | Patient-reported or inferred duration of loss |
| Family history | Structured flag + detail |
| Previous treatments | Medical and surgical history relevant to hair (medications, procedures, dates where known) |

### 3.3 Donor assessment

| Area | Content |
| --- | --- |
| Density | Donor density assessment (method-specific in real clinics) |
| Hair characteristics | Colour, wave, contrast with skin (high-level descriptors) |
| Hair type | E.g. straight / wavy / curly taxonomy |
| Hair calibre | Fine / medium / coarse or measured where available |

### 3.4 Medical assessment

| Area | Content |
| --- | --- |
| Current medications | Active medications with relevance to surgery |
| Current conditions | Comorbidities affecting suitability or anaesthesia |
| Scalp condition | Disease, scarring, dermatitis, prior surgery, etc. |

### 3.5 Recommendations

Recommendations are **clinical-commercial options** discussed or advised, not necessarily the final sold package.

| Category | Examples |
| --- | --- |
| Surgery | FUE/FUT, combined approaches, staged sessions |
| PRP | Platelet-rich plasma as adjunct |
| PRF | Platelet-rich fibrin |
| Exosomes | Where legally offered and clinically documented |
| Medications | Finasteride, minoxidil, dutasteride (where appropriate), etc. |

Each line item may later carry **indication**, **contraindication flags**, and **patient-specific nuance** (structured + narrative).

### 3.6 Consultation notes

Free-text or rich narrative: patient goals, counselling points, limitations discussed, alternatives declined, and anything that does not fit a pick-list.

### 3.7 Quote information

Logical grouping for **financial proposal** tied to this consultation:

- Line items (procedures, sessions, add-ons)
- Validity window, currency, taxes/discounts (locale-dependent)
- Versioning if the quote is revised

**Relationship:** Consultation **1 → n** quotes over time is a common pattern; “Quoted” lifecycle ties to presence of an active or historical quote.

### 3.8 Case conversion

Logical grouping for **conversion**:

- Linked **case** identifier(s)
- Conversion timestamp and actor
- Mapping from accepted quote line items to case scope (future detail)

---

## 4. Structured vs free text vs AI-generated fields

This section classifies **intent** for each major area. Implementation may store AI output as **draft** columns or separate **AI suggestion** objects; that is a Stage 3B+ decision.

### 4.1 Patient information

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Name, DOB | ✓ (from person/patient when linked) | Legal name variants in notes if needed | Rare; only if transcribed and confirmed |
| Contact details | ✓ (typed channels) | Ad-hoc instructions (“call after 5pm”) | Low; extraction from voice with **human confirm** |
| Referral source | ✓ (enum + “other”) | Referrer story, campaign detail | Optional classification from unstructured lead text |
| Consultant | ✓ (staff IDs) | — | — |

### 4.2 Hair loss assessment

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Pattern classification | ✓ | Nuance (“temporal triangle”) | **Assist** from photos + history (draft) |
| Grade | ✓ | — | **Assist** if model outputs grade with confidence |
| Duration | ✓ (ranges) or semi-structured | Patient narrative | **Assist** from transcript |
| Family history | ✓ (yes/no/unknown) + degree | Detail | **Assist** summary from narrative |
| Previous treatments | ✓ (procedure/medication types) | Dates, doses, outcomes | **Assist** extraction from notes |

### 4.3 Donor assessment

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Density | ✓ (numeric or banded by method) | Method notes | **Assist** from imaging tooling (future) |
| Hair characteristics | Mixed (pick-lists + sliders) | Colour/contrast nuance | **Assist** from standardised photos |
| Hair type | ✓ | — | **Assist** with confirmation |
| Hair calibre | ✓ | — | **Assist** with confirmation |

### 4.4 Medical assessment

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Medications | ✓ (drug + dose + frequency where possible) | Unstructured list in intake | **Assist** normalisation from text (high risk → confirm) |
| Conditions | ✓ (problem list codes or clinic taxonomy) | Narrative | **Assist** with mandatory clinician review |
| Scalp condition | ✓ (flags) | Description, derm findings | **Assist** from clinician-entered + imaging |

### 4.5 Recommendations

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Modality toggles (surgery, PRP, …) | ✓ | — | **Assist** ranked options from assessment |
| Per-modality rationale | — | ✓ | **Draft** rationale from model |
| Contraindications / defer | ✓ | ✓ | **Assist** flags from meds/conditions |

### 4.6 Consultation notes

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Primary narrative | — | ✓ | **Draft** from transcript + prompts |
| Sectioned headings | Optional templates | ✓ | **Draft** section fills |

### 4.7 Quote information

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Line items, prices, validity | ✓ | Terms and conditions reference | **Suggest** packages from assessment + price list |
| Discount / package rationale | Partial | ✓ | **Suggest** wording (marketing-sensitive) |

### 4.8 Case conversion

| Field / group | Structured | Free text | AI-generated |
| --- | ---: | ---: | ---: |
| Case link, timestamps, actor | ✓ | Handover notes | — |

**Principle:** Anything affecting **safety, consent, or legal commitment** keeps **human confirmation** in the loop; AI outputs default to **draft** or **suggestion** with provenance.

---

## 5. AI-assisted areas

These are **product surfaces** where models add leverage. They do not imply a single model or a fixed prompt architecture in Stage 3A.

| Area | Role of AI |
| --- | --- |
| **Consultation summary** | Condense structured fields + notes into patient-facing or internal summaries; multiple tones (clinical vs lay). |
| **Treatment recommendations** | Suggest modalities and staging from assessments; surface contraindications and “discuss with patient” prompts. |
| **Graft estimation** | Assist ranges from donor assessment + pattern (tooling-dependent); always framed as **estimate**, not prescription. |
| **Quote suggestions** | Map recommended plan to catalogue SKUs / packages; flag missing price list items. |
| **Follow-up recommendations** | Suggest next touchpoints (review PRP series, photos at N months, medication monitoring) for CRM/calendar integration later. |

**Cross-cutting requirements (for later stages):** tenant-configurable **tone**, **locale**, **disallowed claims**, **audit logs** of model version and inputs used, and explicit **clinician sign-off** before patient-visible artefacts leave draft.

---

## 6. Relationship mapping

Logical relationships ConsultationOS must honour within Follicle Intelligence. Cardinalities are **typical**; tenants may vary.

| Relationship | Cardinality (typical) | Description |
| --- | --- | --- |
| **Consultation → Person** | n → 1 (optional early) | Consultation eventually binds to a canonical **person** (and often **patient**) for continuity of care. |
| **Consultation → Lead** | 1 → 0..1 | Many consultations originate from a **CRM lead**; some may start from walk-in / patient record without a lead. |
| **Consultation → Quote** | 1 → n | Revisions, alternates, and rescoped quotes over time. |
| **Consultation → Case** | 1 → 0..n | Usually 1 active case from a successful path; duplicates/archived consultations may exist. |
| **Consultation → Photos** | 1 → n | Consultation-scoped imaging (global photos may also link via **patient**). |
| **Consultation → Audit trail** | 1 → n | Append-only or event-sourced history: edits, AI accept/reject, state transitions, quote/case links. |

**Design intent:** Consultation remains the **anchor** for “what we believed at decision time,” even as the **case** becomes the operational hub after conversion.

---

## 7. Future live consultation notes

Stage 3A **anticipates** real-time and multimodal capture without specifying transport or storage.

### 7.1 Auto-save

- **Concept:** Continuous persistence of in-progress sections (structured + narrative) to prevent loss during long encounters or flaky networks.
- **Product implication:** Conflict handling (single editor vs multi-staff), debounced writes, and clear **Draft vs In progress** semantics.

### 7.2 Timeline

- **Concept:** Append-only **timeline** of micro-events: section edits, AI drafts inserted, images attached, quote generated, patient portal viewed.
- **Product implication:** Distinct from free-text “notes” — supports compliance, coaching, and debugging “how did we get this quote?”

### 7.3 Voice transcription

- **Concept:** Streaming or batch speech-to-text during consultation, bound to **tenant** and **session**, with speaker diarization where feasible.
- **Product implication:** Consent banners, retention policy, PII redaction options, and language selection.

### 7.4 AI note extraction

- **Concept:** Models parse transcript + structured context to **propose** field updates (meds, pattern, recommendations) as **reviewable chips** mapped to the record schema—not silent overwrites.
- **Product implication:** UX for accept/reject per field, and audit entries tying suggestions to transcript offsets (future).

---

## 8. Recommended MVP scope (Stages 3B–3D)

Phasing is **documentation guidance** for implementation planning; exact tickets may split differently.

### 8.1 Stage 3B — Foundation persistence and API shape

**Goal:** Make consultation a **durable tenant-scoped entity** with minimal viable fields and clean relationships—still **no** full UI polish requirement if a thin admin surface suffices internally.

Suggested inclusion:

- Entity identity: tenant, timestamps, lifecycle state machine (Draft → In progress → Completed minimum).
- Links: **person/patient** (optional), **lead** (optional), **consultant** attribution.
- Core structured blocks: patient information (as much as already normalised elsewhere), hair loss assessment, donor assessment, medical assessment (medications/conditions as structured lists).
- Consultation notes (free text) with versioning or last-edited metadata (design choice in 3B).
- Audit trail events for create/update/state change.
- Read/write boundaries aligned with existing **CRM / portal** gate patterns (reuse established auth philosophy from FI Admin).

Explicit **deferrals** for 3B: live voice, full quote engine UI, graft estimator UX, patient portal.

### 8.2 Stage 3C — Quotes, conversion, and clinical handoff

**Goal:** Close the loop from **consultation** to **quote** and **case**.

Suggested inclusion:

- Quote linkage model (1 → n), quote lifecycle basics, and **Quoted** / **Accepted** consultation states.
- **Converted to case** workflow: create or link **case**, copy forward provenance pointers (not necessarily deep cloning of all clinical substructures).
- Recommendations block as structured line items suitable for quote mapping.
- Integration hooks to existing **case** and **patient** foundations (read paths, not duplicate clinical stores).
- Optional: first **AI-assisted** feature behind feature flag—e.g. consultation summary only.

### 8.3 Stage 3D — AI-assisted workflows and live encounter UX

**Goal:** Differentiate ConsultationOS as an **intelligence** layer: faster documentation, safer suggestions, better downstream packages.

Suggested inclusion:

- AI drafts: treatment recommendations, graft estimation assistance, quote suggestions, follow-up recommendations—with provenance and sign-off.
- Live consultation mode: auto-save, session timeline, transcription pipeline (even if MVP is “upload audio file”).
- Richer **photos** integration at consultation scope (ties to patient images foundation when available).
- Archival rules, superseded consultations, and analytics exports (aggregated structured fields).

---

## Document control

| Item | Value |
| --- | --- |
| Stage | 3A — architecture and data model design |
| Next stages | 3B (persistence/API), 3C (quote/case), 3D (AI + live) |
| Implementation | **Out of scope** until follow-on specs and migrations are explicitly approved |

When implementation begins, cross-link this document to CRM (`17-crm-foundation-architecture.md`), universal patient (`11-universal-patient-record.md`), universal case (`12-universal-case-record.md`), patient images (`22-patient-images-foundation.md`), AI strategy (`05-ai-integration-strategy.md`), and FI OS roadmap (`19-fi-os-current-state-and-dashboard-roadmap.md`) so gates and RLS posture stay coherent.
