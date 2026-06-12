# FI OS Stage 8C — Clinical Photography Analytics & Incomplete Capture Alerts

## Purpose

Stage 8C adds **read-only analytics**, **computed operational alerts**, and **FI Admin visibility** for Smart Clinical Photography protocol sessions (Stage 8B) across a tenant. It supports **HairAudit** and **Hair Longevity** readiness by reusing the same pure calculators and `source_system`-scoped loaders—without donor-density analysis, Norwood/Ludwig/Sinclair grading, or outcome prediction.

## Analytics definitions

| Metric | Definition |
|--------|------------|
| **Total sessions** | Rows in `hli_photo_protocol_sessions` matching the loader window and filters (including `cancelled`). |
| **Non-cancelled sessions** | Same set excluding `status = cancelled` (denominator for completion rate). |
| **Protocol completion rate** | `complete` sessions ÷ non-cancelled sessions (0 if denominator is 0). |
| **Incomplete session count** | Sessions not `complete` and not `cancelled` (operational backlog). |
| **Sessions with required gaps** | Sessions where at least one **required** template slot row is unsatisfied vs the Stage 8B gate (see below). |
| **Needs retake count** | Count of **required** `hli_photo_protocol_session_slots` with `status = needs_retake`. |
| **Needs review count** | Count of **required** slots in `captured` with `ai_match_confidence` **below** `PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE` (same threshold as auto-complete gate in Stage 8B). |
| **Missing required slot frequency** | Per `slot_slug`, count of **required** slot rows that are unsatisfied (missing / needs retake / weak captured, etc.). **Optional** slots are excluded. |
| **Most commonly missed slot** | `slot_slug` with highest frequency from the map (stable tie: first max encountered). |
| **Average time to complete** | Mean of `completed_at - started_at` for sessions with `status = complete` and parseable timestamps. |
| **Completion rate by clinical_context** | Groups by `metadata->>clinical_context` (or `unknown`). |
| **Completion rate by clinic** | Uses `fi_patients.primary_clinic_id` when the patient map is available; sessions without a resolvable clinic are omitted from this bucket. |
| **Completion rate by creator** | Groups by `created_by_user_id`; null creators bucketed as `__unassigned__`. |
| **Audit readiness score** | 0–100 composite documented in `protocolAnalytics.ts`: blends completion rate with pressure from retake + review counts (not a regulatory certification). |

**Required slot satisfied** (aligned with `completePhotoProtocolSessionIfEligible` / `canCompleteRequiredSessionSlots`):

- `accepted`, or  
- `captured` with `ai_match_confidence >= PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE` (0.48 today).

Optional slots never block completion, never increment missing-frequency for “incomplete” analytics, and are ignored for retake/review headline counts.

### Loader defaults

- **Date window**: `created_at` between `date_from` and `date_to`. If omitted, defaults to the **last 90 days** through “now”.  
- **Row cap**: up to **5000** sessions per query; when hit, `scan_note` explains truncation.  
- **`clinic_id` filter**: matches `fi_patients.primary_clinic_id` (not a column on protocol sessions).

## Alert rules (computed only)

Alerts are built in `protocolAlerts.ts` at read time—**no alert table** in this stage.

| Type | When | Typical severity |
|------|------|------------------|
| `missing_required_images` | Any required slot unsatisfied | `high` unless session oddly `complete` (`medium`) |
| `protocol_incomplete_over_24h` | Session `draft` / `in_progress` / `incomplete` and `started_at` older than 24h | scales with age |
| `needs_retake` | Any required slot `needs_retake` | `high` |
| `low_confidence_capture` | Required slot `captured` below strong threshold | `medium` |
| `hairaudit_not_ready` | `source_system = hairaudit` and session not `complete` | `medium`–`high` |
| `follow_up_missing_images` | `clinical_context = follow_up` and any required missing | `medium` |

Each alert includes: `severity`, `source_system`, nullable `patient_id` / `case_id`, `session_id`, `clinical_context`, `message`, `recommended_action`, `detected_at` (ISO).

## UI

- **Route**: `/fi-admin/[tenantId]/foundation-integrity` (FoundationOS).  
- **Components**: `PhotoProtocolAnalyticsCard`, `PhotoProtocolIncompleteSessionsTable` (embedded after Twin health KPIs).  
- **Patient Twin link**: Smart Photography Protocol card links to the FoundationOS anchor `#fi-os-photo-protocol-analytics`.

### Manual test steps

1. Sign in as a tenant member with FI Admin access.  
2. Open `/fi-admin/{tenantId}/foundation-integrity`.  
3. Confirm **Clinical photography protocol** KPIs render (zeros are valid on empty tenants).  
4. Start a protocol from a Patient Twin (`/fi-admin/{tenantId}/patients/{id}/twin`), leave it incomplete, refresh FoundationOS — **Incomplete sessions** and the table should reflect the session.  
5. Confirm **Tenant protocol analytics** on the Twin card navigates to the FoundationOS section.  
6. (Optional) Mark a required slot **needs retake** in Twin; confirm alerts list includes `needs_retake`.

## HairAudit / HLI future extension

- `adapters/hairAuditPhotoProtocolAnalytics.server.ts` and `adapters/hairLongevityPhotoProtocolAnalytics.server.ts` wrap the shared loader with `source_system` filters for HairAudit and Hair Longevity.  
- When those systems persist sessions into `hli_photo_protocol_sessions`, the same analytics and alerts apply without schema changes in Stage 8C.

## Intentionally not included

- Donor density analysis  
- Norwood / Ludwig / Sinclair grading  
- Outcome prediction  
- Persisted alert queue / notifications / cron delivery (computed alerts only)  
- Cross-tenant reporting  

## Related code

- Pure analytics: `src/lib/hair-intelligence/photoProtocols/protocolAnalytics.ts`  
- Alerts: `src/lib/hair-intelligence/photoProtocols/protocolAlerts.ts`  
- Loaders: `src/lib/hair-intelligence/photoProtocols/photoProtocolAnalyticsLoader.server.ts`  
- Stage 8B runbook: `docs/runbooks/fi-os-stage8b-smart-clinical-photography-protocol.md`  

## Migrations

None for Stage 8C (reads existing Stage 8B tables).
