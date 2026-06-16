# ConsultationOS — Visual Assessment Engine v1

## Purpose

Clinical selectors for pattern and scalp-zone capture **without changing persisted JSON contracts**:

- `norwood_classification` — string (Norwood option key), same as legacy `select` + `norwood_scale`.
- `ludwig_classification` — string (Ludwig option key).
- `selected_zones` — `string[]` of canonical scalp zone ids (`consultation_scalp_zones` option set).
- `repair_visual_annotations` — JSON object: known scalp zone keys → arrays of repair annotation tags.

The engine adds **optional** diagram / schematic UX and **always keeps** dropdown or checkbox fallbacks where a visual field is used in the published code templates.

## Static assets

Replaceable SVGs (and optional PNGs if you extend loaders later) live under:

**`/consultation-os/visual-assessment/`** (repository: `public/consultation-os/visual-assessment/`)

See `README.md` in that folder for filenames. Interactive maps also render an inline SVG schematic for reliable touch hit-testing.

## Form field types (`ConsultationFormFieldType`)

| Type | Typical field id | Stored value |
|------|------------------|--------------|
| `visual_norwood` | `norwood_classification` | `string` |
| `visual_ludwig` | `ludwig_classification` | `string` |
| `visual_scalp_zones` | `selected_zones` | `string[]` |
| `visual_repair_annotations` | `repair_visual_annotations` | `object` (zone → tag[]) |

Parsing and defensive normalisation live in `src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel.ts` (`parseSelectedZones`, `parseRepairVisualAnnotations`, `normalizePatternClassificationString`).

## Templates using visual fields (code defaults)

These **in-repo** published schemas include visual types (see `src/lib/consultationForms/templates/*`):

- Hair transplant adaptive v2 / v2.1 — `visual_norwood`, `selected_zones` in surgical assessment.
- Hair loss treatment (HLI) — `visual_norwood` / `visual_ludwig` (when pattern gates apply), `selected_zones`.
- Female hair loss — `visual_ludwig` (when pattern gates apply), `selected_zones`.
- Hair transplant repair — `visual_repair_annotations`, `selected_zones`.

## Tenant DB versions

`fi_consultation_form_instances` rows are **pinned** to the `template_version_id` they were created with. Existing tenants keep older JSON schemas (e.g. plain `select` for Norwood) until:

- A **new** `fi_consultation_form_template_versions` row is published / seeded from this repo, and  
- New form instances bind to that version (per your `ensure*ConsultationFormTemplate` / provisioning flow).

The **ConsultationFormFieldRenderer** only switches to visual components when the **stored schema** for that instance declares the visual `type`. Older published versions without those types continue to render classic controls.

## Operational notes

- **No DB / RLS / server-action contract changes** are required for v1; values remain JSON in `fi_consultation_form_instances.values`.
- **Completion summaries** use existing extractors (`readString`, pattern lines, etc.); empty or malformed visual-only keys are ignored by parsers used by the UI; rules modules do not assume `selected_zones` / `repair_visual_annotations` are present.
- **Legacy codes**: if a stored Norwood/Ludwig string is not in the current option set, the visual field surfaces a **Legacy** chip and `<option>` so clinicians can read and migrate the value.

## Related doc

ConsultationOS v2 checkpoint table: `docs/architecture/consultation-os-v2-consolidation-checkpoint.md`.
