import assert from "node:assert/strict";
import test from "node:test";

import {
  isAwsTextractPathologyExtractionConfigured,
  isGoogleVisionPathologyExtractionConfigured,
  isOpenAiPathologyExtractionConfigured,
  readPathologyExtractionMinOcrConfidenceFromEnv,
  resolvePathologyExtractionProviderIdFromEnv,
} from "@/src/lib/pathology/pathologyExtractionProvider";
import { providerAuditToEventDetail } from "@/src/lib/pathology/pathologyExtractionProviderAudit";
import {
  AwsTextractPathologyExtractionProvider,
  GoogleVisionPathologyExtractionProvider,
  OpenAiPathologyExtractionProvider,
} from "@/src/lib/pathology/pathologyExtractionProviderLive.server";
import { StubPathologyExtractionProvider } from "@/src/lib/pathology/pathologyExtractionProviderStub";
import {
  buildPathologyExtractionConfidenceSummary,
  FI_PATHOLOGY_STUB_PROVIDER_ID,
  normalizePathologyExtractionProviderId,
} from "@/src/lib/pathology/pathologyExtractionProviderTypes";
import { resolvePathologyExtractionJobStatus } from "@/src/lib/pathology/pathologyExtractionWorker.server";

test("provider env defaults to stub", () => {
  assert.equal(resolvePathologyExtractionProviderIdFromEnv({}), FI_PATHOLOGY_STUB_PROVIDER_ID);
  assert.equal(
    normalizePathologyExtractionProviderId("textract"),
    "aws-textract-v1"
  );
  assert.equal(
    normalizePathologyExtractionProviderId("openai"),
    "openai-vision-v1"
  );
});

test("confidence summary flags low marker confidence for manual review", () => {
  const summary = buildPathologyExtractionConfidenceSummary(
    [{ test_label: "Ferritin", result_value: "45", confidence: 0.2 }],
    0.95,
    0.55
  );
  assert.equal(summary.meets_threshold, false);
  assert.equal(summary.markers_below_threshold, 1);
});

test("stub provider parses embedded fixture markers", async () => {
  const markers = [
    {
      test_label: "Ferritin",
      result_value: "45",
      result_unit: "ug/L",
      reference_range: "30-300",
      flag: "normal",
      confidence: 0.9,
    },
  ];
  const pdf = new TextEncoder().encode(`FI_PATHOLOGY_MARKERS_JSON=${JSON.stringify(markers)}`);
  const stub = new StubPathologyExtractionProvider();
  const out = await stub.extractFromPdf(pdf);
  assert.equal(out.provider, FI_PATHOLOGY_STUB_PROVIDER_ID);
  assert.equal(out.markers.length, 1);
  assert.equal(out.providerAudit.outcome, "extracted");
  assert.equal(out.requiresManualReview, false);
});

test("textract shell falls back to manual review without credentials", async () => {
  const adapter = new AwsTextractPathologyExtractionProvider();
  const out = await adapter.extractFromPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {});
  assert.equal(out.provider, "aws-textract-v1");
  assert.equal(out.requiresManualReview, true);
  assert.equal(out.providerAudit.credential_present, false);
  assert.match(out.providerAudit.fallback_reason ?? "", /not configured/i);
});

test("vision shell falls back to manual review without credentials", async () => {
  const adapter = new GoogleVisionPathologyExtractionProvider();
  const out = await adapter.extractFromPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {});
  assert.equal(out.provider, "google-vision-v1");
  assert.equal(out.requiresManualReview, true);
});

test("openai shell falls back when api key missing", async () => {
  const adapter = new OpenAiPathologyExtractionProvider();
  const out = await adapter.extractFromPdf(new TextEncoder().encode("Ferritin | 45 | ug/L"), {});
  assert.equal(out.provider, "openai-vision-v1");
  assert.equal(out.requiresManualReview, true);
  assert.equal(isOpenAiPathologyExtractionConfigured({}), false);
});

test("configured credential helpers", () => {
  assert.equal(
    isAwsTextractPathologyExtractionConfigured({
      AWS_ACCESS_KEY_ID: "a",
      AWS_SECRET_ACCESS_KEY: "b",
      AWS_REGION: "ap-southeast-2",
    }),
    true
  );
  assert.equal(
    isGoogleVisionPathologyExtractionConfigured({ GOOGLE_CLOUD_VISION_API_KEY: "key" }),
    true
  );
  assert.equal(readPathologyExtractionMinOcrConfidenceFromEnv({}), 0.55);
});

test("job status routes low-confidence extraction to needs_review", () => {
  const status = resolvePathologyExtractionJobStatus({
    provider: FI_PATHOLOGY_STUB_PROVIDER_ID,
    rawTextPreview: "",
    rawExtractionJson: {},
    normalizedMarkers: [],
    extractedMarkerCount: 1,
    skippedMarkerCount: 0,
    medicalIntelligencePreview: null,
    ocrConfidence: 0.2,
    source: "embedded_json",
    providerAudit: {
      provider_id: FI_PATHOLOGY_STUB_PROVIDER_ID,
      requested_provider_id: FI_PATHOLOGY_STUB_PROVIDER_ID,
      outcome: "fallback_manual_review",
      fallback_reason: "low confidence",
      latency_ms: 1,
      credential_present: true,
      external_request_id: null,
      invoked_at: "2026-07-02T10:00:00.000Z",
    },
    requiresManualReview: true,
    confidenceSummary: buildPathologyExtractionConfidenceSummary(
      [{ test_label: "Ferritin", result_value: "45", confidence: 0.2 }],
      0.2,
      0.55
    ),
  });
  assert.equal(status.jobStatus, "needs_review");
});

test("provider audit serializes for inbox events", () => {
  const detail = providerAuditToEventDetail({
    provider_id: "aws-textract-v1",
    requested_provider_id: "aws-textract-v1",
    outcome: "fallback_manual_review",
    fallback_reason: "shell",
    latency_ms: 12,
    credential_present: false,
    external_request_id: null,
    invoked_at: "2026-07-02T10:00:00.000Z",
  });
  assert.equal(detail.provider_id, "aws-textract-v1");
  assert.equal(detail.outcome, "fallback_manual_review");
});
