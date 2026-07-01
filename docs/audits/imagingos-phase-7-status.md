# ImagingOS Phase 7 Status — Patient Portal Exports + Reviewer UX

**Date:** 2026-07-01  
**Base commit:** `208f903` — `feat(imagingos): add outcome signals and patient-safe exports`  
**Phase 7 commit:** (this phase) — `feat(imagingos): add patient exports and reviewer ux`

---

## Phase 7 deliverables

| Task | Status | Notes |
|------|--------|-------|
| Patient-safe portal/PDF wiring | Complete | Portal route, PDF handout API, case summary print section |
| Staff reviewer directory picker | Complete | Tenant-scoped loader; queue select + bulk assign/unassign |
| Optional live Norwood staff signal | Complete | `FI_IMAGING_ENABLE_LIVE_NORWOOD_PROVIDER` (default off) |
| SurgeryOS longitudinal surfacing | Complete | Phase links + review/Twin/gallery/compare deep links |
| Reviewer UX polish | Complete | Names, retake badge, bulk assignment, filter dropdown |

---

## Patient-safe export wiring

- **Portal:** `/patient/[tenantId]/imaging` — `PatientImagingPortalClient` + redacted cards with signed previews
- **PDF handout:** `GET /api/tenants/.../patients/.../imaging/handout/pdf` — pdf-lib renderer
- **Case summary print:** Patient-safe imaging status blocks in case summary document
- **Mapper:** `patientSafeImagingExportMapperCore.ts` + `patientSafeImagingExportLoad.server.ts`

### Remaining export gaps

- Automated email-to-patient for imaging handouts (pathology-style send flow not wired)
- Staff “release to portal” approval gate per image

---

## Reviewer picker status

- **Loader:** `imagingReviewerDirectoryLoader.server.ts` — `fi_staff` (linked) + eligible `fi_users`
- **UI:** Searchable select in review queue; filter dropdown; bulk assign/unassign
- **Fallback:** Manual UUID input when directory load fails or returns empty

---

## Norwood staff signal status

- **Flag:** `FI_IMAGING_ENABLE_LIVE_NORWOOD_PROVIDER=false` (default)
- **Core:** `imagingNorwoodSignalCore.ts` — `imagingos_norwood_signal_v1`
- **Worker:** `norwood_grade` job branch uses `buildLiveNorwoodSignalSummary`
- **Patient safety:** Export mapper strips `imaging_job_summaries`; card redaction tests exclude Norwood wording

---

## SurgeryOS surfacing status

- **Core:** `surgeryOsLongitudinalIntelligenceCore.ts`
- **Loader:** `loadSurgeryOsVieCaptureSummaries` attaches `longitudinalSurfacing`
- **UI:** `SurgeryOsVieCapturePanel` — review queue, Patient Twin, gallery, VIE compare links; per-phase status

---

## Updated ImagingOS Readiness Score: **9.0 / 10**

**Rationale:** Patient-safe exports reach portal, PDF, and print surfaces; reviewers assign via directory picker; optional Norwood staff signal; SurgeryOS surfaces longitudinal intelligence with staff deep links.

**Previous (Phase 6):** 8.5 / 10

---

## Remaining gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| Imaging handout email delivery | Medium | PDF route exists; email flow deferred |
| Per-image portal release approval | Medium | All active images mapped when portal linked |
| Predictive surgery simulation | Deferred | Out of scope |
| Patient self-capture | Deferred | Out of scope |

---

## Recommended next phase (Phase 8)

> **ImagingOS Phase 8 — Portal release gates & handout delivery**  
> Add staff approval before portal visibility; wire imaging handout email; optional automated patient notifications on retake; deepen VIE comparison readiness in Patient Twin surgery cards.

---

## Tests added

- `patientSafeImagingExportMapperCore.test.ts`
- `imagingReviewerDirectoryCore.test.ts`
- `imagingNorwoodSignalCore.test.ts`
- `surgeryOsLongitudinalIntelligenceCore.test.ts`
- `imagingReviewAssignmentMutations.test.ts` — bulk assign/unassign (extended)