# ImagingOS Phase 7A — Patient Visual Summary Report

**Date:** 2026-07-01  
**Base:** Phase 7 patient-safe exports (`d57ac82`)  
**Commit:** `feat(imagingos): add patient visual summary reports`

---

## What the report includes

| Section | Surgery post-op | HairAudit |
|---------|-----------------|-----------|
| Header (patient, clinic, dates, disclaimer) | Yes | Yes |
| Post-op photo panel (signed previews) | Yes | Yes |
| Graft distribution map (4 zones) | Yes | Optional |
| Hairline / design principles | Yes | If recorded |
| Graft type summary (SurgeryOS session) | Yes | N/A |
| Density gradient (staff-recorded only) | If recorded | If recorded |
| Healing / growth timeline (generic) | Yes | Yes |
| What we will monitor | Yes | Yes |
| Audit mode summary | No | Yes |

Report types: `surgery_post_op_summary`, `hairaudit_visual_summary`.

---

## Patient safety constraints

Excluded from patient-facing output:

- AI confidence scores and raw AI findings
- Internal staff review notes
- Norwood / Ludwig grades (unless explicitly clinician-approved — not wired in 7A)
- AI-invented density or graft zone counts
- Outcome scores, survival prediction, guaranteed-result language
- Predictive simulation

Mapper uses `patientSafeReportTextIsAllowed()` and redacted image metadata from Phase 6 export core.

**Approval required** before `patientAccessAllowed` is true (`draft` → `approved` / `exported` on `fi_cases.metadata.patient_visual_summary_reports`).

---

## Data sources

| Field | Source |
|-------|--------|
| Graft type totals | `fi_surgery_graft_sessions` (session composition) |
| Per-zone graft counts | `fi_cases.metadata.patient_visual_summary_record.recipient_zones` only |
| Density zones | `patient_visual_summary_record.density_zones` only |
| Hairline principles | Staff record or whitelisted phrases in surgery plan notes |
| Photos | `fi_patient_images` + signed preview URLs |
| HairAudit views | Images with `metadata.upload_source === "hairaudit"` |
| Approval | `fi_cases.metadata.patient_visual_summary_reports` |

Missing values display **"Not recorded"** — nothing is invented.

---

## Integration surfaces

- **SurgeryOS** — `SurgeryOsVieCapturePanel` (post-op summary per surgery)
- **Patient Twin** — `PatientTwinImagingCard` gallery section
- **Case detail** — HairAudit + surgery summary panels on images section
- **ImagingOS workspace** — toolbar above gallery tabs
- **PDF** — `GET /api/tenants/.../patients/.../imaging/visual-summary/pdf`

Staff actions: Preview, Export PDF, Mark approved for patient, Regenerate (resets to draft).

---

## Remaining gaps

| Gap | Priority |
|-----|----------|
| Per-zone graft capture UI in SurgeryOS (staff record → metadata) | High |
| Patient portal surfacing of approved visual summary (not just handout cards) | Medium |
| Embedded images in PDF (text-only PDF in 7A) | Medium |
| Clinician-approved Norwood display toggle | Low |
| Email delivery of approved summary | Low |

---

## Recommended next phase (7B)

1. Staff UI to record zone graft counts and density zones into `patient_visual_summary_record`
2. Patient portal route for approved visual summary (read-only, signed images)
3. PDF renderer with embedded post-op thumbnails
4. Automated regenerate on graft reconciliation complete or post-op capture complete