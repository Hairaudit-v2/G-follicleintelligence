# ConsultationOS v2 — consolidation checkpoint & clinic release

This document is the **product checkpoint** for ConsultationOS v2: **six active pathway templates**, the **pathway-first hub**, **guided form routes**, **completion summaries**, **post-completion routing**, **Visual Assessment v1** on new HT template JSON, and **legacy HT instance compatibility**.

Use it as a **clinic testing release checklist** before widening access beyond pilot tenants.

---

## Active pathways (v2)

All six pathways are **active** in the launcher and have **direct form routes** under `{base} = /fi-admin/{tenantId}/consultations/{consultationId}`.

| # | Pathway | Template slug | Direct route | Primary code / tests |
|---|---------|----------------|--------------|----------------------|
| 1 | **Hair Transplant** | `hair-transplant-consultation` | `{base}/forms` | `hairTransplantConsultationTemplate.ts`, `hairTransplantCompletionRules*.ts`, `hairTransplantConsultationV2.workflow.test.ts`, `consultationOsV2Checkpoint.test.ts` |
| 2 | **Hair Loss Treatment / HLI** | `hair-loss-treatment-consultation` | `{base}/forms/hair-loss-treatment` | `hairLossTreatmentConsultationTemplate.ts`, `hairLossTreatmentCompletionRules*.ts` |
| 3 | **Female Hair Loss** | `female-hair-loss-consultation` | `{base}/forms/female-hair-loss` | `femaleHairLossConsultationTemplate.ts`, `femaleHairLossCompletionRules.test.ts` |
| 4 | **Repair** | `hair-transplant-repair-consultation` | `{base}/forms/repair` | `hairTransplantRepairConsultationTemplate.ts`, `hairTransplantRepairCompletionRules*.ts` |
| 5 | **Follow-up / Review** | `follow-up-review-consultation` | `{base}/forms/follow-up` | `followUpReviewConsultationTemplate.ts`, `followUpReviewCompletionRules.test.ts` |
| 6 | **Scalp Disorder / Pathology** | `scalp-pathology-consultation` | `{base}/forms/pathology` | `scalpPathologyConsultationTemplate.ts` (add dedicated unit tests when stabilising) |

Routing constants: `PATHWAY_FORM_RELATIVE_HREF` in `src/lib/consultations/consultationPathwayRouting.ts`. Launcher + heuristics: `consultationPathwayLauncherModel.ts`, `ConsultationPathwayLauncher.tsx`.

---

## Clinic testing — release checklist

Copy into an MR or runbook and tick when verified on **staging** (or local against real template seeds).

### Core flows

- [ ] **Pathway-first new consultation** — Hub with **no** pathway completion summary shows **pathway launcher** first (`buildConsultationHubLayoutPlan` → `orderedSections` starts with `pathway_launcher`). Starting each pathway creates or continues the correct in-room instance.
- [ ] **Hub layout states** — With **no** `pathwayCompletionSummary`: launcher + intake ordering; **with** summary: intelligence summary, routing tiles, launcher, intake (`consultationHubLayoutPlan.ts`, `ConsultationOsWorkspace.tsx`).
- [ ] **Direct form routes** — Each route loads **without** using the launcher card:
  - `{base}/forms`
  - `{base}/forms/hair-loss-treatment`
  - `{base}/forms/female-hair-loss`
  - `{base}/forms/repair`
  - `{base}/forms/follow-up`
  - `{base}/forms/pathology`
- [ ] **Completion summary dispatch** — On **complete / locked** workflow, rules summaries and pathway-specific snapshots persist and surface in the hub intelligence card where applicable (`ConsultationFormRunner.tsx`, completion builders, `consultationOsV2Checkpoint.test.ts`).
- [ ] **Post-completion routing** — **Only** when `workflowPhase === "complete"`: `ConsultationPostCompleteRouting` + hand-off panels; not shown during draft or submitted-only review.

### Data model & compatibility

- [ ] **Visual assessment fields** — On **new** HT template publish: Norwood / Ludwig / zones / repair annotation field types render; older `template_version_id` rows keep legacy controls. See [Visual Assessment Engine v1](consultation-os-visual-assessment-v1.md).
- [ ] **Old HT v1/v2 compatibility** — Legacy instances are **not** rewritten; UI renders stored JSON; `clinician_voice_note` still feeds previews / completion dual-read where present.
- [ ] **New HT latest schema** — New instances bind to **latest published** global HT row (today **DB version 3** = HT v2.1: no dictation field in schema); `schemaRevision` **6** on JSON.

### Templates (non-HT)

- [ ] **HLI** — Non-surgical pathway unchanged slug; validation + completion tests green.
- [ ] **Female hair loss** — Template + completion tests green; launcher card and `/forms/female-hair-loss`.
- [ ] **Repair** — Five sections; quote hand-off hidden where designed; SurgeryOS hand-off respects flags.
- [ ] **Follow-up / Review** — Longitudinal fields only; no surgical quote/donor/planning leakage in completion snapshot.
- [ ] **Pathology** — Inflammatory / scarring / infectious framing; no surgical planning fields; route `/forms/pathology`.

### Automated gates (CI / pre-pilot)

- [ ] **Test commands** (all zero exit):

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
```

---

## Automated coverage (CI)

`npm run test:unit` walks all `*.test.ts` under `lib/`, `src/`, and `packages/`. Consultation-form–related entry points (non-exhaustive):

- `src/lib/consultationForms/consultationFormCondition.test.ts`
- `src/lib/consultationForms/consultationFormValidation.test.ts`
- `src/lib/consultationForms/completion/hairTransplantCompletionRules.test.ts`
- `src/lib/consultationForms/completion/hairLossTreatmentCompletionRules.test.ts`
- `src/lib/consultationForms/hairTransplantConsultationV2.workflow.test.ts` (includes **v2.1 schema** assertions)
- `src/lib/consultationForms/consultationOsV2Checkpoint.test.ts` (cross-cutting v2 checkpoint: HT, HLI, female, repair, follow-up dispatch)
- `src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel.test.ts`
- `src/lib/consultationForms/templates/hairTransplantRepairConsultationTemplate.test.ts`
- `src/lib/consultationForms/completion/hairTransplantRepairCompletionRules.test.ts`
- `src/lib/consultationForms/templates/femaleHairLossConsultationTemplate.test.ts`
- `src/lib/consultationForms/completion/femaleHairLossCompletionRules.test.ts`
- `src/lib/consultationForms/templates/followUpReviewConsultationTemplate.test.ts`
- `src/lib/consultationForms/completion/followUpReviewCompletionRules.test.ts`
- `src/lib/consultationForms/handoff/consultationHandoffPure.test.ts`
- `src/lib/consultations/consultationPathwayLauncherModel.test.ts`

---

## Behaviour matrix (what the code guarantees)

| Area | Expected behaviour | Where it lives |
|------|---------------------|----------------|
| **New HT instances** | Bind to **latest published** `fi_consultation_form_template_versions` row (today **version 3** = HT v2.1 JSON: no `clinician_voice_note` in schema). | `ensureGlobalHairTransplantConsultationTemplate` + `ensureInRoomHairTransplantConsultationFormInstance` in `consultationFormMutations.server.ts` |
| **HT v2.1 schema (code)** | `hairTransplantConsultationSchema` / `hairTransplantConsultationSchemaV2_1` omit `clinician_voice_note`; `schemaRevision` 6 (Visual Assessment v1 adds `selected_zones` + `visual_norwood`). | `templates/hairTransplantConsultationTemplate.ts` |
| **Legacy HT v1/v2 rows** | Never **updated**; instances keep their frozen `template_version_id`. UI still renders fields present in that version’s JSON (including legacy dictation). | DB immutability + `ConsultationFormFieldRenderer` |
| **Legacy `clinician_voice_note` values** | Still merged into `clinicianNotesPreview` / completion dual-read. | `consultationCompletionExtractors.ts` → `buildHairTransplantCompletionSummary` |
| **HLI pathway** | Slug `hair-loss-treatment-consultation`; dedicated template + completion rules. | `hairLossTreatmentConsultationTemplate.ts`, `hairLossTreatmentCompletionRules*.ts` |
| **Female pathway** | Slug `female-hair-loss-consultation`; completion dispatch exposes pathway 3 snapshot fields (checkpoint test). | `femaleHairLossConsultationTemplate.ts`, `consultationOsV2Checkpoint.test.ts` |
| **Pathway launcher** | Six cards; HT → `/forms`; HLI → `/forms/hair-loss-treatment`; Female → `/forms/female-hair-loss`; Repair → `/forms/repair`; Follow-up → `/forms/follow-up`; Pathology → `/forms/pathology`. Progress from latest in-room instance per slug. | `consultationPathwayLauncherModel.ts`, `ConsultationPathwayLauncher.tsx`, consultation `page.tsx` |
| **Pathway 4 — Repair** | Slug `hair-transplant-repair-consultation`; **five sections**; HairAudit + SurgeryOS flags; **quote draft hand-off hidden** for this slug when locked; SurgeryOS hand-off when proceed + flag (no graft-range gate). | Repair template + completion + `ConsultationHandoffPanel.tsx`, `consultationHandoffPure.ts` |
| **Pathway 5 — Follow-up / Review** | Longitudinal intelligence; completion dispatch returns pathway 5 snapshot fields (checkpoint test). | `followUpReviewConsultationTemplate.ts`, `consultationOsV2Checkpoint.test.ts` |
| **Pathway 6 — Scalp pathology** | Dedicated template slug; launcher + route wired; strengthen with template/completion unit tests as the pathway hardens. | `scalpPathologyConsultationTemplate.ts`, routing in `consultationPathwayRouting.ts` |
| **Repair launcher hint** | `recommendConsultationPathwayKey` may return `repair` when notes match **repair signals** and there is surgical/transplant context. | `consultationPathwayLauncherModel.ts` |
| **Post-completion routing** | **Only** when workflow is **complete** (`locked`): `ConsultationPostCompleteRouting` + hand-offs; not shown during draft or submitted review. | `ConsultationFormRunner.tsx` (`workflowPhase === "complete"`) |
| **HT completion UI** | **Clinical decision snapshot** (six sections), not the dense legacy grid. | `ConsultationCompletionSummaryCard.tsx` (HT slug branch) |
| **Canonical HT note** | `structured_clinical_note` + `AiGeneratedClinicalNoteField` on handoff section (HT + `clinical_summary_handoff`). | `ConsultationFormFieldRenderer.tsx`, `AiGeneratedClinicalNoteField.tsx` |

---

## Legacy hub `ConsultationOs*Panel` audit (cleanup pass — no deletes in this pass)

Pre–v2 hub used section-bound **panel** components under `src/components/fi-admin/consultations/`. **Grep audit (imports / references):** none of the named exports below are imported anywhere outside their own files — the **guided form engine** and **hub** no longer mount them.

### Requested categories

| Category | File | Unused (no external imports) | Still referenced | Safe to remove later |
|----------|------|------------------------------|------------------|------------------------|
| assessment | `ConsultationOsAssessmentPanel.tsx` | Yes | No | Yes — after product confirms no plans to revive legacy hub editor |
| donor | `ConsultationOsDonorPanel.tsx` | Yes | No | Yes |
| medical | `ConsultationOsMedicalPanel.tsx` | Yes | No | Yes |
| recommendations | `ConsultationOsRecommendationsPanel.tsx` | Yes | No | Yes |
| quote | `ConsultationOsQuotePanel.tsx` | Yes | No | Yes |
| billing | *(no `ConsultationOsBillingPanel`)* | N/A | N/A | N/A — billing UX lives outside this panel set (e.g. settings / hand-offs) |
| notes | `ConsultationOsNotesPanel.tsx` | Yes | No | Yes |

### Same-status siblings (not in the original list)

These match the same “defined only, never imported” pattern:

- `ConsultationOsBodyHairPanel.tsx`
- `ConsultationOsBeardDesignPanel.tsx`
- `ConsultationOsBrowDesignPanel.tsx`
- `ConsultationOsMedicalHairLossPanel.tsx`
- `ConsultationOsRegenerativeAssessmentPanel.tsx`

**Recommendation:** Keep files until one release after pilot sign-off; then delete in a single chore MR with a quick smoke of `fi-admin` consultations, or archive behind a `legacy/` folder if legal/compliance wants retained artefacts.

---

## Visual Assessment Engine v1

Image-backed Norwood / Ludwig / scalp-zone / repair annotation fields ship as **new `ConsultationFormFieldType` values** only on **newly published** template JSON from this repo. Instances pinned to older `template_version_id` rows keep legacy `select` / `multi_select` controls. See **[Visual Assessment Engine v1](consultation-os-visual-assessment-v1.md)** for field ids, asset paths (`/consultation-os/visual-assessment/`), and tenant publish notes.

---

## Manual smoke (staging / local)

1. **New HT (v3 template)** — Launcher → **Hair Transplant** → `{base}/forms`. Confirm **no** “Clinician dictation” field under Clinical Summary / Handoff on new instances. Submit → review snapshot → complete → **Where next?** routing; hand-offs below.

2. **Old HT instance (v1 or v2 template_version)** — Open existing instance on older version: form still renders; completion summary still builds (including legacy dictation in preview if values exist).

3. **HLI** — Launcher → **Hair Loss Treatment** → `{base}/forms/hair-loss-treatment`. Complete flow validates.

4. **Female** — `{base}/forms/female-hair-loss` — load, save, submit, completion summary.

5. **Repair** — `{base}/forms/repair` — repair snapshot on complete; no quote hand-off card where hidden; SurgeryOS card respects flags.

6. **Follow-up / Review** — `{base}/forms/follow-up` — longitudinal fields; completion snapshot matches pathway 5 expectations.

7. **Pathology** — `{base}/forms/pathology` — non-surgical framing; no HT planning leakage.

8. **Direct routes** — Deep-link each `{base}/forms/...` URL above without using the launcher; each loads.

---

## Pathway 4: Hair Transplant Repair (short spec)

- **Slug:** `hair-transplant-repair-consultation`  
- **Route:** `{base}/forms/repair`  
- **Purpose:** Revision / correction after previous transplant (donor/recipient risk, design, scarring, growth — not a hidden HT form).  
- **Sections (5):** rapid intake → previous surgery history → repair assessment → corrective recommendation → clinical summary / handoff.  
- **HairAudit + SurgeryOS:** boolean recommendations on-form; snapshot surfaces in completion summary.  
- **Quote:** hidden by design on locked hand-offs for this template.  
- **Completion:** `repairConsultationCompletionSnapshot` on persisted rules summary (`buildHairTransplantRepairCompletionSummary`).  
- **Launcher:** Repair card **active** (same Start / Continue / Review model as other pathways).  
- **Recommendation signals:** free-text tokens such as repair, revision, failed transplant, poor growth, overharvesting, scarring, pluggy / unnatural grafts or hairline — plus surgical or transplant-type context (`recommendConsultationPathwayKey`).

---

## Versioning reference

- **DB** `fi_consultation_form_template_versions.version`: `1` = legacy HT v1 schema, `2` = HT v2 (with dictation), `3` = HT v2.1 (no dictation).  
- **Code** `schemaRevision` on JSON: v1 uses its own revision; v2 uses `5`; v2.1 uses `6` (see template file comments).  
- **Repair:** published template **version 1** only (separate global template row).
