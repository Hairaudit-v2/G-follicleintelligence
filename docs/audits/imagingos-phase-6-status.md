# ImagingOS Phase 6 Status — Live Outcome Signals + Patient-Safe Exports

**Date:** 2026-07-01  
**Base commit:** `3bd9ca1` — `feat(imagingos): unify protocols and patient twin ingest`  
**Phase 6 commit:** (this phase) — `feat(imagingos): add outcome signals and patient-safe exports`

---

## Phase 6 deliverables

| Task | Status | Notes |
|------|--------|-------|
| Live density/outcome providers | Complete | Feature-flagged (`FI_IMAGING_ENABLE_LIVE_*`); default off; staff-only `imagingos_outcome_signals_v1` summaries |
| Patient-safe export cards | Complete | `patientSafeImagingExportCore.ts` + `PatientSafeImagingExportCard.tsx`; no diagnosis/prediction |
| Protocol resolver — guided capture | Complete | `imagingOsLoad.server.ts` resolves templates; wizard shows catalog source/version |
| Protocol resolver — SurgeryOS | Complete | `surgeryOsVieCapture.server.ts` loads resolved slots; metadata + staff warnings |
| Review queue filters | Complete | Server-side `matchesImagingReviewQueueFilters`; UI form on review page |
| Review assignment routing | Complete | `imaging_review_assignment` metadata; assign/unassign actions + queue UI |

---

## Live outcome signal status

- **Flags:** `FI_IMAGING_ENABLE_LIVE_DENSITY_PROVIDER`, `FI_IMAGING_ENABLE_LIVE_OUTCOME_PROVIDER` (default `false`).
- **Worker:** `density_estimate` and `outcome_score` job branches use `buildLiveDensitySignalSummary` / `buildLiveOutcomeScoreSignalSummary`.
- **Provider resolution:** `liveImagingSignalProviders.server.ts` → `hli_openai` | `stub` | `unavailable`.
- **Degradation:** Disabled flag → `unavailable`; enabled but provider down → safe `unavailable` with review required.
- **Metadata:** Summaries stored under `imaging_job_summaries` with provider, version, confidence, limitations.

---

## Patient-safe export status

- **Core:** `buildPatientSafeImagingExportCard`, `redactMetadataForPatientExport`, forbidden-pattern checks.
- **Allowed wording:** Image received, quality suitable, clinical review recommended, retake requested, non-diagnostic progress labels.
- **Excluded:** Diagnosis, Norwood/Ludwig, density numbers, graft/outcome prediction, AI confidence, staff notes.
- **Integration:** Component ready for PDF/portal handouts; not yet wired into automated export pipeline.

---

## Protocol resolver expansion

### Guided capture wizard

- Templates loaded via `loadResolvedProtocol()` with tenant DB → canonical → HLI → VIE fallback.
- Capture uploads write `protocol_catalog_source` / `protocol_catalog_version` via `protocolCaptureMetadataCore`.
- Wizard template buttons display resolved catalog source/version.

### SurgeryOS

- `loadResolvedProtocolSlots("surgery_day")` feeds capture summary and slot guidance.
- `buildVieSurgeryImageMetadata` includes catalog source/version and `protocol_session_id`.
- Staff warnings: `missing_protocol_session`, `protocol_legacy_fallback`.

---

## Review queue routing status

- **Filters:** review reason, quality, confidence band, capture source, view type, patient/case, protocol session, assigned reviewer, retake, date range.
- **Assignment:** `assignImagingReviewAction` / `unassignImagingReviewAction`; metadata key `imaging_review_assignment` separate from AI and staff review.
- **Preserved:** Signed previews, staff review history, AI metadata on assign/unassign.

---

## Updated ImagingOS Readiness Score: **8.5 / 10**

**Rationale:** Optional live staff signals behind flags; patient-safe redaction layer; protocol resolver unified across guided capture and SurgeryOS; review queue supports filtering and assignment routing. Predictive surgery simulation explicitly deferred.

**Previous (Phase 5):** 8.0 / 10

---

## Remaining gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| Patient portal PDF export pipeline | Medium | Card component ready; not auto-wired |
| Staff reviewer picker (name lookup) | Low | Assignment uses user ID input |
| Live density vision model (numeric) | Deferred | Qualitative staff signal only by design |
| Predictive surgery simulation | Deferred | Out of scope Phase 6 |
| Full protocol catalog deprecation | Low | Parallel catalogs preserved |

---

## Recommended next phase (Phase 7)

> **ImagingOS Phase 7 — Patient portal exports & reviewer UX**  
> Wire patient-safe export cards into portal/PDF handouts; add staff reviewer directory picker; optional live Norwood staff signal behind flag; deepen SurgeryOS longitudinal comparison surfacing.

---

## Tests added

- `imagingOutcomeSignalsCore.test.ts` — flag off/on, provider unavailable, low confidence, metadata preservation
- `patientSafeImagingExportCore.test.ts` — redaction and forbidden wording
- `protocolCaptureMetadataCore.test.ts` — catalog source/version in capture metadata
- `imagingClinicalReviewQueueFilters.test.ts` — key server-side filters
- `imagingReviewAssignmentCore.test.ts` — assign/unassign metadata shape
- `imagingReviewAssignmentMutations.test.ts` — assign, unassign, tenant isolation, AI preserved
- `surgeryOsVieCapture.test.ts` — protocol catalog metadata + session warnings (extended)