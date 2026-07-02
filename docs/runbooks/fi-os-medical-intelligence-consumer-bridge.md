# FI OS — Medical Intelligence Consumer Bridge (Sprint B)

FI OS consumes deterministic clinical intelligence from **`@hairlongevity/medical-intelligence-core`**. HLI remains the **source of truth** for biomarker interpretation, clinical insights, eligibility rules, and normalized longevity signals.

FI OS must **not** duplicate ferritin, thyroid, vitamin D, or other biomarker interpretation rules locally. The adapter in `src/lib/clinical-intelligence/` maps FI pathology data into the shared package and delegates all clinical logic there.

---

## Package dependency

```json
"@hairlongevity/medical-intelligence-core": "file:../HairLongevityInstitute/packages/medical-intelligence-core"
```

Sibling-repo `file:` link during monorepo extraction. Publish or workspace-link when the package is published internally.

---

## Adapter surface

| File | Role |
|------|------|
| `medicalIntelligenceCore.ts` | Pure mapping + delegation (unit-testable) |
| `medicalIntelligenceCore.server.ts` | Server entry re-export (`server-only`) |

### Functions

- **`interpretFiPathologyMarkers(items)`** — maps `fi_pathology_result_items` → `interpretMarkers()` from the package
- **`buildFiClinicalInsights(input)`** — shared `buildClinicalInsights()`; no FI-local insight rules
- **`buildFiLongevitySignals(input)`** — shared `buildLongevitySignals()` from interpreted FI markers
- **`getFiBloodworkEligibility(input)`** — shared `getEligibility()` with FI questionnaire bridge context

---

## Data mapping: `fi_pathology_result_items` → package marker input

| FI field | Package field | Notes |
|----------|---------------|-------|
| `test_label` (preferred) or `test_code` | `marker_name` | Registry alias resolution happens in the package |
| `result_value` (parsed numeric) | `value` | Non-numeric values are skipped safely |
| `result_unit` | `unit` | Passed through |
| `reference_range` (parsed) | `reference_low`, `reference_high` | Heuristic parse only (`30-300`, `<5`, `>10`) |

**Not mapped (by design this sprint):**

- FI `flag` — package re-interprets from value + registry/lab refs
- FI `metadata` / extraction confidence — reserved for OCR sprint
- Trend fields (`collected_at`, `intake_id`) — HLI row shape; FI trends need a follow-up adapter

---

## Mapping gaps (known)

1. **Reference range text** — complex lab formats (e.g. age/sex-specific footnotes) may not parse to numeric low/high.
2. **Lab test codes** — FI template codes (`FERR`, `TFT`) are not canonical; **`test_label`** is used for registry lookup.
3. **Non-numeric results** — qualitative results (`Negative`, `see note`) are skipped; interpretation array may be partial.
4. **Eligibility bridge** — `getFiBloodworkEligibility` expects HLI-shaped `LongevityQuestionnaireResponses`; full FI patient → questionnaire mapping is incremental.
5. **Recent pathology** — FI sets `medicalHistory.priorBloodTests = "last_3_months"` when `hasRecentPathologyOnFile` is true; finer-grained recency is a later sprint.
6. **Sex/age context** — FI clinical context from pathology handoff is not yet passed into interpretation (registry defaults apply).

---

## Out of scope (Sprint B)

- Pathology inbox ingestion
- OCR / extraction pipelines
- Treatment engine
- New clinical thresholds
- Changes to existing pathology request/result CRUD flows

---

## Tests

```bash
pnpm test:medical-intelligence-core
```

Covers package import, marker interpretation, clinical insights, longevity signals, and safe handling of incomplete/unknown markers.

---

## Next sprint recommendation (Sprint C)

1. **Wire adapter into Patient Twin / pathology review UI** — show shared `InterpretedMarker` status alongside raw FI items (read-only).
2. **Questionnaire bridge** — map FI patient metadata + consultation forms → `LongevityQuestionnaireResponses` for eligibility without manual shaping.
3. **Persist interpretation snapshot** — optional JSON on `fi_pathology_results.metadata` (similar to `hli_pathology_handoff`) for audit/replay.
4. **Trend adapter** — map FI result history to `BloodResultMarkerRowInput` when multiple dated results exist per patient.
5. **Publish package** — replace `file:` link with internal registry version once HLI extraction stabilizes.

---

## Related

- HLI package: `HairLongevityInstitute/packages/medical-intelligence-core`
- FI HLI handoff (unchanged): `hliPathologyHandoffCore.ts`, `hliPathologyHandoff.server.ts`
- Stage 5 clinical intelligence runbook: [fi-os-stage5-clinical-intelligence.md](./fi-os-stage5-clinical-intelligence.md)
