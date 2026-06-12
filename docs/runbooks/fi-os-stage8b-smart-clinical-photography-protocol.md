# FI OS Stage 8B — Smart Clinical Photography Protocol

## Purpose

Stage 8B adds a **shared Hair Longevity Intelligence (HLI) photo protocol** layer so staff can run **standardized clinical photography checklists** for consultations, surgery, follow-ups, HairAudit-style audits, and HLI intake/progress. Compliance is computed from **existing Stage 8A** `fi_patient_images` AI metadata (category, surgery stage, hair/shave state, review status, confidence). There is **no new vision model** and **no duplicate classifier prompt**; ad-hoc analysis uses the existing `classifyPatientImageAction`.

## What is intentionally out of scope

- Donor density analysis  
- Norwood / Ludwig / Sinclair grading  
- Custom CV training or new image classifiers  
- Full HairAudit / Hair Longevity UIs (thin server adapters only)

## Database tables

Migration: `supabase/migrations/20260731120001_fi_os_stage8b_hli_photo_protocol.sql`

| Table | Role |
|--------|------|
| `hli_photo_protocol_templates` | Named protocol definitions (`slug`, `clinical_context`, `source_system_scope`, etc.). |
| `hli_photo_protocol_slots` | Ordered checklist rows: required category (or `acceptable_image_categories` for alternates), optional surgery/hair/shave constraints, guidance copy, `is_required`. |
| `hli_photo_protocol_sessions` | A run of a template for a tenant/patient (or other product via `source_system` + `source_record_id`). |
| `hli_photo_protocol_session_slots` | Per-slot progress: linked `patient_image_id`, `status`, `ai_match_confidence`, staff notes, review fields. |

**Source systems** on sessions: `fi_os`, `hairaudit`, `hair_longevity` (templates may use `source_system_scope` including `shared`).

**Indexes** (high level): tenant + patient, source_system + source_record_id, session_id, status, protocol_template_id.

**RLS** follows FI patterns: templates/slots readable broadly where configured; session rows tenant-scoped for `SELECT`; `service_role` retains full DML for automation.

## Seeded templates

| Slug | Clinical context | Summary |
|------|------------------|---------|
| `consultation_standard` | `consultation` | Front, profiles, top, crown, donor (all required). |
| `surgery_pre_op_standard` | `surgery_pre_op` | Same + recipient-style slot (acceptable categories). |
| `immediate_post_op_standard` | `surgery_immediate_post_op` | Front, hairline/front, top, crown, donor; optional graft tray. |
| `follow_up_standard` | `follow_up` | Standard views; donor optional. |
| `hli_intake_standard` | `hli_intake` | Core set; donor + microscopic optional. |
| `hairaudit_case_standard` | `hairaudit_case` | Multi-stage audit mix (pre-op / immediate post-op / follow-up views). |

Exact slot rows live in the migration seed `INSERT` blocks.

## How protocol compliance works

TypeScript entry point: `calculatePhotoProtocolCompliance` in `src/lib/hair-intelligence/photoProtocols/protocolCompliance.ts`.

- **Required** slots must have at least one gallery image whose **slot match score** meets an internal strong threshold (see `STRONG_MATCH` in that file).  
- **Optional** slots never set `complete` to false; they only contribute suggestions and warnings.  
- Images with **unknown or empty** AI category score **0** for the slot and **cannot** satisfy a required slot.  
- **Suggested matches** use `scoreImageForProtocolSlot` (`protocolSlotMatching.ts`): category (and acceptable list), optional surgery/hair/shave alignment, confidence weighting, and review-status boost.  
- **Session completion** (FI OS) additionally requires each **required session slot** to be `accepted`, or `captured` with match score ≥ `PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE` in `protocolSessionRules.ts` (used by `protocolSession.server.ts`).

## Relationship to Stage 8A

Stage 8A populates `fi_patient_images` fields such as:

- `ai_image_category`, `ai_image_category_confidence`  
- `ai_surgery_stage`, `ai_hair_state`, `ai_shave_state`  
- `ai_image_review_status`  

The Patient Twin loader maps gallery items into `ProtocolComplianceImage` and recomputes compliance on each load — **no extra OpenAI calls** unless staff use **Analyse missing images**, which calls `classifyPatientImageAction` per unclassified id.

## FI OS UI

Component: `src/components/fi-admin/patientTwin/PatientTwinPhotoProtocolCard.tsx` (embedded in `PatientTwinDashboard` after imaging).

Staff can:

1. Pick **clinical context** and **Start protocol** (creates `fi_os` session + session slots).  
2. **Attach** suggested images or **Mark accepted** / **Needs retake**.  
3. **Analyse missing images** when unclassified gallery items exist.  
4. **Complete protocol** when `can_complete_session` is true (server enforces the same rules).

## HairAudit / HLI future use

Placeholders:

- `src/lib/hair-intelligence/photoProtocols/adapters/hairAuditPhotoProtocol.server.ts`  
- `src/lib/hair-intelligence/photoProtocols/adapters/hairLongevityPhotoProtocol.server.ts`  

These load seeded templates and return compliance summaries; FI-style session persistence can be wired when each product owns navigation and tenancy rules.

## Manual test checklist

1. Apply migration (`supabase migration up` or `db reset` in dev).  
2. Open **Patient Twin** for a patient with gallery images.  
3. **Start** e.g. consultation protocol; confirm **missing** rows and progress bar.  
4. Run **Analyse missing images** if applicable; reload and confirm **suggested matches** update.  
5. Accept or correct categories in existing imaging UI; reload Twin and confirm **progress** updates.  
6. **Complete protocol** only when required slots are satisfied (accept or strong capture).

## Stage 8C (recommended prompt direction)

**Stage 8C — Protocol analytics & ops:** aggregate protocol completion rates by clinic/context, SLA alerts for incomplete pre-op sets, optional export to case PDF, and HairAudit/HLI session creation from their native record IDs with shared compliance API.
