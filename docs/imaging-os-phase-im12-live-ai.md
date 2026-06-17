# ImagingOS Phase IM-12 — First Live AI Adapter (Feature Flag Protected)

## What IM-12 adds

Phase IM-12 introduces the **first live AI execution adapter** in `src/lib/imaging-os/liveAi.ts`. It wires IM-11 readiness and output contracts to a **stub provider** that returns fake but contract-valid responses — without calling OpenAI, Anthropic, or any external API.

New components:

| Component | Purpose |
|-----------|---------|
| `ImagingOsAiFeatureFlags` | Environment-safe toggles for AI enablement, risk tiers, dry run, provider |
| `canExecuteAiVisionTask()` | Permission gate by risk level and flags |
| `ImagingOsAiProvider` | Provider abstraction for future real integrations |
| `ImagingOsStubAiProvider` | Deterministic stub responses for three low-risk tasks |
| `buildAiVisionExecutionPrompt()` | Deterministic prompt/schema generation for future providers |
| `executeImagingAiVisionTask()` | Orchestration: permission → dry run → execute → validate → audit |
| `ALLOWED_IM12_TASKS` | Hard allowlist restricting IM-12 to three low-risk tasks |
| `recommendSafeAiTasks()` | Score-based recommendation of safe tasks only |
| `runHairAuditAiTask()` | HairAudit adapter wrapping the execution engine |

IM-12 does **not** change UI, API endpoints, or database schema.

## Why only low-risk tasks are allowed

IM-12 is the **safety phase** for live AI wiring. Only tasks with `risk_level: "low"` in the IM-11 registry are permitted:

- `image_category_classification`
- `image_quality_assessment`
- `protocol_gap_detection`

Medium-risk tasks (hair loss staging, donor/recipient assessment), high-risk tasks (growth comparison, density measurement, graft survival, hairline design), and clinical-review tasks (surgical outcome review, Digital Twin summary) are **blocked at the execution layer** even if feature flags would otherwise allow them.

This prevents accidental execution of clinical decision or outcome-scoring tasks before real provider integration and clinical governance are in place.

## Feature flag safety architecture

`DEFAULT_IMAGING_AI_FLAGS` ships with safe defaults:

```ts
{
  ai_enabled: false,
  allow_low_risk_tasks: true,
  allow_medium_risk_tasks: false,
  allow_high_risk_tasks: false,
  allow_clinical_review_tasks: false,
  dry_run_mode: true,
  provider: "stub",
}
```

Execution requires **both** `ai_enabled: true` and the appropriate risk-tier flag. IM-12 further restricts to `ALLOWED_IM12_TASKS`.

| Flag | Default | Effect |
|------|---------|--------|
| `ai_enabled` | `false` | Master kill switch |
| `allow_low_risk_tasks` | `true` | Permits low-risk tasks when AI enabled |
| `allow_medium_risk_tasks` | `false` | Blocks medium-risk tasks |
| `allow_high_risk_tasks` | `false` | Blocks high-risk tasks |
| `allow_clinical_review_tasks` | `false` | Blocks clinical review tasks |
| `dry_run_mode` | `true` | Audit only, no provider call |
| `provider` | `"stub"` | Provider selection (`stub` only in IM-12) |

## Dry run behavior

When `dry_run_mode: true` (default), `executeImagingAiVisionTask()`:

1. Passes permission and IM-12 allowlist checks
2. Returns `execution_status: "dry_run"`
3. Generates an audit log contract via `buildAiVisionAuditLogContract()`
4. Does **not** invoke the provider

This supports staging and integration testing without model execution.

## Provider abstraction layer

`ImagingOsAiProvider` defines a single method:

```ts
executeTask(request: ImagingOsAiVisionRequestContract): Promise<ImagingOsAiVisionModelOutputContract>
```

`createAiProvider()` returns:

- **`stub`** — implemented in IM-12 (`ImagingOsStubAiProvider`)
- **`openai`**, **`anthropic`**, **`local`** — placeholders; throw until IM-13

The execution engine selects the provider from flags or accepts an injected provider for testing.

## Output validation

After provider execution, outputs pass through IM-11's `validateAiVisionModelOutputContract()`:

- `request_id` and `task_type` must match the request
- Output contract version must be `imaging-ai-output-contract-v1`
- Measurement domains must be allowed by the request
- Confidence values must be 0–1

Invalid output returns `execution_status: "validation_failed"` with blockers populated.

## Audit generation

Every execution path (blocked, dry run, executed, validation failed) produces an `ImagingOsAiVisionAuditLogContract` via the IM-11 `buildAiVisionAuditLogContract()` helper. Audit metadata includes execution status and dry-run flag where applicable.

## Why clinical tasks remain blocked

Clinical and high-risk tasks can influence treatment decisions, outcome scoring, or Digital Twin narratives. IM-12 intentionally:

- Excludes them from `ALLOWED_IM12_TASKS`
- Keeps `allow_medium_risk_tasks`, `allow_high_risk_tasks`, and `allow_clinical_review_tasks` at `false` by default
- Uses `recommendSafeAiTasks()` instead of IM-11's broader `recommendAiVisionTasksForSummary()` for live execution recommendations

IM-11 readiness evaluation remains available for planning; IM-12 execution is restricted.

## HairAudit adapter

`src/lib/imaging-os/adapters/hairAuditLiveAiAdapter.ts` exposes `runHairAuditAiTask()`, which accepts an IM-11 request contract and optional flags, then delegates to `executeImagingAiVisionTask()`. No API surface changes.

## Recommended IM-13: real provider integration

IM-13 should add:

1. **OpenAI Vision** (or Anthropic) provider behind an environment gate
2. Real prompt assembly using `buildAiVisionExecutionPrompt()` output
3. Signed URL or storage-backed image retrieval (with PHI safeguards)
4. Environment-driven flag overrides (e.g. `IMAGING_AI_ENABLED` in server config)
5. Gradual expansion of allowed tasks only after clinical review workflow is defined

Keep `dry_run_mode` and `ai_enabled` defaults until production validation completes.

## Tests

Run:

```bash
npm run test:imaging-os-im12
```

Covers feature flags, permission gates, IM-12 allowlist, dry run, stub provider, output validation, prompt builder, provider factory, HairAudit adapter, safe recommendations, and IM-1–IM-11 compatibility.
