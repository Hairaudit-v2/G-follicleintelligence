# ConsultationOS v2 — consolidation checkpoint

This document is the **product checkpoint** for Hair Transplant (HT) v2.1, HLI hair-loss pathway, **pathway 4 repair**, pathway launcher, completion summaries, and post-completion routing working together.

## Automated coverage (CI)

Run the full unit sweep (includes all consultation-form tests):

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
```

Consultation-form–related test entry points (non-exhaustive; see `package.json` `test:unit` for the full list):

- `src/lib/consultationForms/consultationFormCondition.test.ts`
- `src/lib/consultationForms/consultationFormValidation.test.ts`
- `src/lib/consultationForms/completion/hairTransplantCompletionRules.test.ts`
- `src/lib/consultationForms/completion/hairLossTreatmentCompletionRules.test.ts`
- `src/lib/consultationForms/hairTransplantConsultationV2.workflow.test.ts` (includes **v2.1 schema** assertions)
- `src/lib/consultationForms/consultationOsV2Checkpoint.test.ts` (cross-cutting v2 checkpoint)
- `src/lib/consultationForms/templates/hairTransplantRepairConsultationTemplate.test.ts`
- `src/lib/consultationForms/completion/hairTransplantRepairCompletionRules.test.ts`
- `src/lib/consultationForms/handoff/consultationHandoffPure.test.ts`
- `src/lib/consultations/consultationPathwayLauncherModel.test.ts`

## Behaviour matrix (what the code guarantees)

| Area | Expected behaviour | Where it lives |
|------|---------------------|----------------|
| **New HT instances** | Bind to **latest published** `fi_consultation_form_template_versions` row (today **version 3** = HT v2.1 JSON: no `clinician_voice_note` in schema). | `ensureGlobalHairTransplantConsultationTemplate` + `ensureInRoomHairTransplantConsultationFormInstance` in `consultationFormMutations.server.ts` |
| **HT v2.1 schema (code)** | `hairTransplantConsultationSchema` / `hairTransplantConsultationSchemaV2_1` omit `clinician_voice_note`; `schemaRevision` 6 (Visual Assessment v1 adds `selected_zones` + `visual_norwood`). | `templates/hairTransplantConsultationTemplate.ts` |
| **Legacy HT v1/v2 rows** | Never **updated**; instances keep their frozen `template_version_id`. UI still renders fields present in that version’s JSON (including legacy dictation). | DB immutability + `ConsultationFormFieldRenderer` |
| **Legacy `clinician_voice_note` values** | Still merged into `clinicianNotesPreview` / completion dual-read. | `consultationCompletionExtractors.ts` → `buildHairTransplantCompletionSummary` |
| **HLI pathway** | Unchanged slug and template; validation tests remain dedicated. | `hairLossTreatmentConsultationTemplate.ts`, `hairLossTreatmentCompletionRules*.ts` |
| **Pathway launcher** | HT card → `/forms`; HLI → `/forms/hair-loss-treatment`; Female → `/forms/female-hair-loss`; **Repair** → `/forms/repair` (active card). Progress from latest in-room instance per slug (`draft` → in progress, else → submitted for CTA). | `consultationPathwayLauncherModel.ts`, `ConsultationPathwayLauncher.tsx`, consultation `page.tsx` |
| **Pathway 4 — Hair Transplant Repair** | Slug `hair-transplant-repair-consultation`; **five sections** (rapid intake → prior surgery → repair assessment → corrective recommendation → clinical summary). **HairAudit** + **SurgeryOS** flags on form; **repair completion snapshot** in rules summary; **quote draft hand-off hidden** for this slug; SurgeryOS hand-off when outcome is proceed-to-surgery **and** SurgeryOS flag set (no graft-range gate). | `templates/hairTransplantRepairConsultationTemplate.ts`, `ensureGlobalHairTransplantRepairConsultationTemplate`, `completion/hairTransplantRepairCompletionRules.ts`, `ConsultationCompletionSummaryCard.tsx`, `ConsultationHandoffPanel.tsx`, `consultationHandoffPure.ts` |
| **Repair launcher hint** | `recommendConsultationPathwayKey` may return `repair` when notes match **repair signals** (e.g. revision, failed transplant, poor growth, overharvesting, scarring, pluggy / unnatural hairline) **and** there is surgical/transplant context. | `consultationPathwayLauncherModel.ts` |
| **Post-completion routing** | **Only** when workflow is **complete** (`locked`): `ConsultationPostCompleteRouting` + hand-offs; not shown during draft or submitted review. | `ConsultationFormRunner.tsx` (`workflowPhase === "complete"`) |
| **HT completion UI** | **Clinical decision snapshot** (six sections), not the dense legacy grid. | `ConsultationCompletionSummaryCard.tsx` (HT slug branch) |
| **Canonical HT note** | `structured_clinical_note` + `AiGeneratedClinicalNoteField` on handoff section (HT + `clinical_summary_handoff`). | `ConsultationFormFieldRenderer.tsx`, `AiGeneratedClinicalNoteField.tsx` |

## Manual smoke (staging / local)

1. **New HT (v3 template)**  
   Open a consultation → pathway launcher → **Hair Transplant** → `/fi-admin/{tenant}/consultations/{id}/forms`.  
   Confirm **no** “Clinician dictation” field under Clinical Summary / Handoff.  
   Submit → review snapshot → complete → **Where next?** routing appears; hand-offs below.

2. **Old HT instance (v1 or v2 template_version)**  
   Open existing instance on older version: form still renders; completion summary still builds (including legacy dictation in preview text if values exist).

3. **HLI**  
   From launcher → **Hair Loss Treatment / HLI** → `/forms/hair-loss-treatment`. Complete flow still validates (see unit tests).

4. **Direct routes (no launcher)**  
   - `{base}/forms`  
   - `{base}/forms/hair-loss-treatment`  
   - `{base}/forms/repair` (pathway 4)

   Each must load without relying on the launcher card.

5. **Repair (pathway 4)**  
   Launcher → **Repair Consultation** → `{base}/forms/repair`. Submit → review **repair snapshot** → complete → confirm **no** quote hand-off card; SurgeryOS card respects form flags.

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

## Versioning reference

- **DB** `fi_consultation_form_template_versions.version`: `1` = legacy HT v1 schema, `2` = HT v2 (with dictation), `3` = HT v2.1 (no dictation).  
- **Code** `schemaRevision` on JSON: v1 uses its own revision; v2 uses `5`; v2.1 uses `6` (see template file comments).  
- **Repair:** published template **version 1** only (separate global template row).
