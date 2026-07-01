# FIN-IMAGING-2 — Unified Classifier Endpoint + Live HIE Activation

**Status:** Implemented (FI OS internal authority)  
**Endpoint:** `POST /api/internal/imaging/classify`  
**Prior work:** [FIN-IMAGING-1 unified imaging architecture audit](./fin-imaging-1-unified-imaging-architecture-audit.md)

---

## Summary

FI OS is now the central internal classifier authority for ecosystem images. A single authenticated endpoint accepts requests from `fi_os`, `hairaudit`, `hli`, and `iiohr`, routes live classification through the shared HLI OpenAI vision stack, and returns intelligence-core V1 contracts.

The legacy HairAudit route (`POST /api/internal/hairaudit/image-classify`) remains available and delegates to the unified service internally.

---

## Endpoint contract

### Request

```json
{
  "source_system": "fi_os | hairaudit | hli | iiohr",
  "source_image_id": "opaque-id-in-source-system",
  "image_url": "optional-public-or-internal-url",
  "signed_url": "optional-time-limited-url",
  "storage_bucket": "required-with-storage_path",
  "storage_path": "required-with-storage_bucket",
  "capture_source": "optional — see ImageCaptureSourceV1",
  "upload_source": "optional opaque string",
  "requested_categories": ["optional", "category", "hints"],
  "patient_id": "optional",
  "case_id": "optional",
  "professional_id": "optional",
  "canonical_photo_category": "optional HairAudit/HLI hint",
  "legacy_upload_type": "optional",
  "image_content_type": "optional MIME",
  "image_size_bytes": 12345,
  "metadata": { "academy_case_id": "...", "professional_id": "..." }
}
```

At least one image reference is required: `image_url`, `signed_url`, or `storage_bucket` + `storage_path`.

### Response

```json
{
  "success": true,
  "classification": { "schemaVersion": 1, "...": "ImageClassificationResultV1" },
  "normalized_signal": { "schemaVersion": 1, "...": "NormalizedImageSignalV1" },
  "fallback_used": false,
  "provider": "hli-openai-vision",
  "processing_version": "hli-image-classifier@1.0.0;model=gpt-4o-mini",
  "warnings": [],
  "generated_at": "2026-07-02T12:00:00.000Z",
  "error": { "code": "classifier_fallback", "message": "..." }
}
```

`error` is present when `fallback_used=true` (provider degradation). Upload pipelines must treat this as non-fatal.

---

## Source system behavior

| Source | Capture default | Notes |
|--------|-----------------|-------|
| `fi_os` | `guided_capture` | Native FI patient image path; preserves existing HIE behavior |
| `hairaudit` | `forensic_audit` | Respects `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub`; no write-back to HairAudit |
| `hli` | `patient_portal` | Classification-only; no HLI production cutover |
| `iiohr` | `clinic_staff` | Maps `academy_case_id`, `professional_id`, `global_professional_id` from body/metadata (PR-6) |

---

## Authentication

### Headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Authorization: Bearer <token>` | Yes | Shared secret |
| `x-fi-source-system` | Optional | Must match body `source_system` when set |
| `x-fi-imaging-timestamp` | When HMAC enabled | Unix ms or seconds |
| `x-fi-imaging-signature` | When HMAC enabled | HMAC-SHA256 hex of `{timestamp}.{rawBody}` |

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN` | — | Primary bearer token (≥16 chars) |
| `FI_INTERNAL_IMAGING_HMAC_SECRET` | — | HMAC secret when required |
| `FI_INTERNAL_IMAGING_REQUIRE_HMAC` | `false` | Enable HMAC validation |
| `FI_INTERNAL_IMAGING_ALLOWED_SOURCES` | `fi_os,hairaudit,hli,iiohr` | Allowlist |
| `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` | — | Legacy fallback bearer token |
| `OPENAI_API_KEY` | — | Required for live HIE classification |

Production fails closed (503) when required secrets are missing. No public unauthenticated endpoint.

---

## Live HIE wiring — root cause

**Previous behavior:** `classifyClinicalHairImageFromModelUrl` (HairAudit wrapper) returned `null` when:

1. `isClinicalHairImageClassifierAvailable()` was false (`OPENAI_API_KEY` missing or `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub`), **before** invoking the live server module.
2. Dynamic import of the server module failed (test/runtime bundling), silently returning `null`.

**Fix:**

- Unified service calls HLI `classifyClinicalHairImageFromModelUrl` directly (server-only, no wrapper gate).
- Live path **always** returns structured output; failures produce `fallback_used=true` with degraded `ImageClassificationResultV1`.
- HairAudit wrapper in live mode returns degraded objects on import failure instead of `null`.

---

## Fallback behavior

| Condition | Provider | `fallback_used` |
|-----------|----------|-----------------|
| Live OpenAI success | `hli-openai-vision` | `false` |
| Missing `OPENAI_API_KEY` | `fi-os-classifier-fallback` | `true` |
| Signed URL failure | `fi-os-classifier-fallback` | `true` |
| OpenAI HTTP/parse error | `fi-os-classifier-fallback` | `true` |
| HairAudit stub mode | `fi-os-stub-v1` | `true` |

Classifier failures never fail the upstream upload pipeline.

---

## Contract mapping

- **HLI output** → `ImageClassificationResultV1` via `src/lib/imaging/unifiedClassifier/contractMapping.ts`
- **Ecosystem envelope** → `NormalizedImageSignalV1` with `subject_id` = patient_id || case_id || source_image_id
- **Category aliases** → `PhotoCategoryV1` via `src/lib/imaging/unifiedClassifier/categoryMapping.ts`

Wire contracts live in `packages/intelligence-core/contracts/`.

---

## Observability

Structured JSON logs (`logStructured`) with events:

- `fi_imaging_classifier_request`
- `fi_imaging_classifier_success`
- `fi_imaging_classifier_fallback`
- `fi_imaging_classifier_null_result` (alert)
- `fi_imaging_classifier_security_rejected` (alert)
- `fi_imaging_classifier_unsupported_source`
- `fi_imaging_classifier_category_alias`

Fields include: `source_system`, `provider`, `processing_version`, `latency_ms`, `fallback_used`.

---

## Staging cutover plan — HairAudit (FIN-IMAGING-3)

1. Deploy unified endpoint to staging with `OPENAI_API_KEY` and `FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN`.
2. Point HairAudit staging classifier client at `/api/internal/imaging/classify` (shadow mode: compare responses).
3. Validate fallback rate < 5% on staging uploads with storage refs.
4. Switch HairAudit production to unified endpoint behind feature flag.
5. Deprecate direct `/api/internal/hairaudit/image-classify` after 30-day parity window.

---

## Future — HLI shadow-mode migration

1. HLI sends scalp/progression images to unified endpoint with `source_system=hli`.
2. Compare V1 contracts against HLI-local classifier output.
3. Enable HLI production cutover only after shadow parity sign-off.

---

## Key files

| File | Role |
|------|------|
| `app/api/internal/imaging/classify/route.ts` | HTTP route |
| `src/lib/imaging/unifiedClassifier/unifiedImageClassifyService.server.ts` | Orchestrator |
| `src/lib/imaging/unifiedClassifier/liveHieClassifier.server.ts` | Live HIE path |
| `src/lib/security/internalImagingClassifierAuth.ts` | Auth + HMAC |
| `src/lib/hairaudit/fiOsHairAuditImageClassifyService.ts` | Legacy adapter shim |
| `tests/unifiedImagingClassifyEndpoint.test.ts` | Endpoint + security tests |

---

## Tests

```bash
pnpm run test:fin-imaging-2
pnpm run test:upload-phase3f
pnpm run typecheck
```
