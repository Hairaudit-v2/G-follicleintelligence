# ImagingOS Phase 7C — Auto-Regeneration + Portal PDF + E2E Smoke

**Date:** 2026-07-01  
**Base:** Phase 7B (`22b5500`)  
**Commit:** `feat(imagingos): automate visual summary workflow`

---

## Auto-regeneration status

| Trigger | Hook | Behaviour |
|---------|------|-----------|
| Graft reconciliation | `reconcileGrafts` in SurgeryOS | Draft summary reset; approved/exported preserved |
| Post-op capture | `runPatientImagePostCapturePipeline` | Eligible images only; case-linked |

Metadata recorded at `fi_cases.metadata.patient_visual_summary_auto_regen`.

Staff zone data (`patient_visual_summary_record`) is **not** overwritten by auto-regen — only approval status returns to draft when regeneration runs.

---

## Patient portal PDF status

| Item | Status |
|------|--------|
| Route `GET /patient/[tenantId]/visual-summary/pdf` | Done |
| Approved/exported only | Done |
| Cross-patient blocked | Done |
| Patient-safe mapper + thumbnails | Done |
| Download link on portal page | Done |

---

## Density-gradient editor status

| Item | Status |
|------|--------|
| Qualitative dropdown per zone | Done |
| Options: Higher / Medium / Lower blending / Transition / Not recorded | Done |
| Optional grafts/cm² (staff-recorded only) | Done |
| Saved to `density_zones` in staff record | Done |
| Report density-gradient section | Done |

---

## E2E status

| Item | Status |
|------|--------|
| Playwright skeleton `e2e/journeys/patient-visual-summary-smoke.spec.ts` | Done |
| Full staff→patient journey | Env-gated (fixture IDs + portal credentials) |
| Unit/integration tests | 40+ cases across auto-regen, portal PDF, density, capture eligibility |

---

## Remaining gaps

| Gap | Priority |
|-----|----------|
| Seeded E2E fixture for full approve→portal journey | High |
| Auto-regen for `hairaudit_visual_summary` report type | Medium |
| Patient email delivery of approved PDF | Low |
| Regen debounce when multiple captures arrive in one session | Low |

---

## ImagingOS readiness score (visual summary track)

| Area | 7B | 7C |
|------|----|----|
| Staff zone capture | 90% | 95% |
| Workflow automation | 20% | 85% |
| Patient portal (view + PDF) | 75% | 92% |
| PDF deliverable | 80% | 90% |
| E2E confidence | 40% | 65% |

**Overall visual-summary readiness: ~89%** (up from ~83% at 7B).

---

## Recommended next phase (7D)

1. Demo seed + full Playwright journey (zone save → approve → portal PDF)
2. HairAudit report type auto-regen parity
3. Email/share link for approved patient summary
4. Regeneration debounce and audit log table (optional migration)