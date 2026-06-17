# ImagingOS Phase IM-4 — Image Quality Intelligence Engine

## What IM-4 Adds

Phase IM-4 introduces a **metadata-first image quality intelligence layer** under `src/lib/imaging-os/quality.ts`. It scores clinical image usability using only fields already available at ingestion time:

- Width, height, file size, content type
- Canonical category, source system, upload surface
- Optional upstream metadata hints (blur, lighting, angle, scalp visibility)

The engine returns structured signals, warnings, blockers, and a clinical usability gate — without fetching images, inspecting pixels, or calling AI models.

## Why Metadata-First Quality Matters

Clinical image pipelines often receive uploads before pixel analysis is available. IM-4 lets ImagingOS:

1. **Gate downstream intelligence early** — protocol evaluation, classification, and future Digital Twin updates can respect quality thresholds immediately.
2. **Stay pure and deterministic** — same metadata always yields the same score; no network or GPU dependencies.
3. **Compose with IM-2/IM-3** — the universal ingestion pipeline chooses metadata evaluation when enough fields exist, otherwise falls back to the IM-1 stub.

## Quality Scoring Rules

Scoring starts at **100** and applies deductions per signal:

| Signal | Pass | Warning | Fail / Blocker |
|--------|------|---------|----------------|
| Content type | JPEG/JPG/PNG/WebP | Missing (−10) | Unsupported (−35, blocker) |
| Dimensions | Both sides ≥ preferred (1200 default) | Missing (−15); 800–1199 (−10) | Either side < 800 (−25, blocker) |
| File size | 250KB–15MB | Missing (−10); 80–250KB (−10); >15MB (−5) | <80KB (−25, blocker) |
| Aspect ratio | 0.45–2.2 | Extreme ratio (−10) | Unknown when dimensions missing |
| Category | Known canonical category | Missing/unknown (−10) | — |
| Blur score (0–1) | <0.4 | 0.4–0.7 (−15) | >0.7 (−30, blocker) |
| Lighting score (0–1) | >0.6 | 0.3–0.6 (−10) | <0.3 (−25, blocker) |
| Angle deviation (°) | <20 | 20–35 (−10) | >35 (−25, blocker) |
| Scalp visibility (0–1) | >0.65 | 0.35–0.65 (−15) | <0.35 (−30, blocker) |

Category-specific expectations (`qualityRules.ts`) tighten thresholds for detail-critical views such as **microscopic** and **graft_tray**.

Final score is clamped to **0–100**.

## Signal Definitions

Each signal is an `ImagingOsImageQualitySignal`:

- **name** — e.g. `content_type`, `dimensions`, `blur_score`
- **status** — `pass`, `warning`, `fail`, or `unknown`
- **score** — running score after that signal’s deduction
- **message** — human-readable explanation

Aggregated **warnings** and **blockers** arrays summarize actionable issues.

## Clinical Usability Threshold

| Quality status | Score / condition | Clinically usable |
|----------------|-------------------|-------------------|
| `excellent` | 90–100 | Yes |
| `acceptable` | 70–89 | Yes |
| `borderline` | 50–69 | No |
| `poor` | <50 or any blocker | No |
| `invalid` | Unsupported type or impossible dimensions/size | No |

Use `canUseImageForClinicalIntelligence(result)` for a concise gate:

```typescript
{ usable: boolean; reason: string; blockers: string[] }
```

## Pipeline Integration

`runImagingOsIngestionPipeline()` in `pipeline.ts`:

1. Calls `evaluateImageQualityFromMetadata()` when intake has width, height, size_bytes, content_type, or quality hint metadata.
2. Falls back to `evaluateImageQualityStub()` otherwise (preserving IM-2/IM-3 behavior).
3. Adds `quality.evaluator_version: "imaging-quality-metadata-v1"` on metadata evaluations.
4. Emits a non-fatal pipeline warning when quality is not clinically usable; classification and protocol steps still run.

## What IM-4 Deliberately Does Not Do

- No schema migrations
- No UI changes
- No AI or vision model calls
- No remote file fetch or download
- No pixel-level analysis (Sharp, OpenCV, etc.)
- No changes to HairAudit endpoint response shape
- Does not remove `evaluateImageQualityStub()`

## Recommended IM-5: Time-Series Progression Engine

Build a metadata-first **progression engine** that compares canonical categories across capture dates for the same patient/case — detecting missing follow-up views, interval gaps, and category drift — without requiring pixel diffing.

## Recommended Later Phase: Pixel-Level Quality Analysis

After IM-4 gates are stable in production, add an optional **IM-6+ pixel pipeline** using Sharp or vision models for blur detection, exposure analysis, and scalp segmentation — feeding scores back into the same signal contract as optional metadata hints.
