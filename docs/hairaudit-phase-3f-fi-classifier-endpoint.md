# HairAudit V2 — Phase 3F: FI OS Classifier Receiving Endpoint

**Date:** 2026-06-17  
**Scope:** Internal FI OS HTTP endpoint that receives HairAudit image-classification requests  
**Repository:** `G-follicleintelligence` (FI OS deployment host)

---

## Executive Summary

Phase 3F implements the **receiving side** of the HairAudit ↔ FI OS image-classification contract. HairAudit's `fiOsImageClassifierClient` POSTs to this endpoint when `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os`.

| Deliverable | Status |
|-------------|--------|
| `POST /api/internal/hairaudit/image-classify` | ✅ |
| `hairauditClassifierAuth.ts` — dedicated bearer token auth | ✅ |
| `fiOsHairAuditImageClassifyService.ts` — validation + classification | ✅ |
| `classifyClinicalHairImageFromModelUrl.ts` — real classifier hook (placeholder) | ✅ |
| Phase 3F tests (`test:upload-phase3f`) | ✅ |

**Non-goals:** No public access, no UI changes, no real ML classifier, no schema migrations.

---

## Endpoint

| Property | Value |
|----------|-------|
| **URL** | `POST /api/internal/hairaudit/image-classify` |
| **Auth** | `Authorization: Bearer <HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN>` |
| **Visibility** | Internal only |
| **Module** | `app/api/internal/hairaudit/image-classify/route.ts` |

HairAudit staging should set:

```env
FI_OS_IMAGE_CLASSIFIER_URL=https://www.follicleintelligence.ai/api/internal/hairaudit/image-classify
FI_OS_IMAGE_CLASSIFIER_TOKEN=<same-value-as-HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN>
```

---

## Environment Variables (FI OS deployment)

| Variable | Required | Purpose |
|----------|----------|---------|
| `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` | **yes** | Bearer token shared with HairAudit. Min 16 chars. Must **not** equal `SUPABASE_SERVICE_ROLE_KEY`. |
| `HAIRAUDIT_IMAGE_CLASSIFIER_MODE` | no | `stub` enables deterministic stub responses. Omit = live mode (503 until real classifier wired). |

---

## Staging Setup

### FI OS (receiver)

```env
HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN=<generate-32+-char-random-token>
HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub
```

### HairAudit (caller)

```env
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED=true
HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED=true
HAIRAUDIT_FI_IMAGE_FETCH_ENABLED=true
HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=fi_os
FI_OS_IMAGE_CLASSIFIER_URL=https://www.follicleintelligence.ai/api/internal/hairaudit/image-classify
FI_OS_IMAGE_CLASSIFIER_TOKEN=<same-token-as-above>
```

Verify:

```bash
npm run typecheck
npm run test:upload-phase3f
```

---

## Request / Response Contract

See HairAudit repo `docs/hairaudit-phase-3f-fi-classifier-endpoint.md` for full field validation tables.

Stub success response (`200`):

```json
{
  "category": "patient_current_front",
  "canonical_photo_category": "patient_current_front",
  "confidence": 0.62,
  "quality_status": "not_evaluated",
  "protocol_status": "not_evaluated",
  "classifier_version": "fi-os-stub-v1",
  "notes": "Stub classification only"
}
```

---

## Rollback Plan

1. **HairAudit:** Set `HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=dry_run`.
2. **FI OS:** Unset `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` or remove route deployment.
3. **Stub testing:** Re-enable `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=stub` on FI OS.

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/internal/hairaudit/image-classify/route.ts` | New internal POST endpoint |
| `src/lib/security/hairauditClassifierAuth.ts` | Dedicated bearer auth |
| `src/lib/hairaudit/fiOsHairAuditImageClassifyService.ts` | Request validation + classification orchestration |
| `src/lib/hairaudit/classifyClinicalHairImageFromModelUrl.ts` | Real classifier hook (placeholder) |
| `src/lib/hairaudit/hairauditImageClassifyContract.ts` | MIME allow-list for inbound requests |
| `tests/hairauditImageClassifyEndpoint.test.ts` | Phase 3F test suite |
| `package.json` | `test:upload-phase3f` script |
