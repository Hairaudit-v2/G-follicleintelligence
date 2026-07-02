import "server-only";

import { z } from "zod";
import type { RawPathologyExtractedMarker } from "./pathologyMarkerNormalize";
import { buildPathologyExtractionProviderAudit } from "./pathologyExtractionProviderAudit";
import type {
  PathologyExtractionProviderAdapter,
  PathologyExtractionProviderEnvSlice,
} from "./pathologyExtractionProvider";
import {
  isAwsTextractPathologyExtractionConfigured,
  isGoogleVisionPathologyExtractionConfigured,
  isOpenAiPathologyExtractionConfigured,
  readPathologyExtractionMinOcrConfidenceFromEnv,
  resolvePathologyExtractionProviderIdFromEnv,
} from "./pathologyExtractionProvider";
import {
  buildManualReviewFallbackOutput,
  extractPdfAsciiText,
  parseMarkersFromExtractedText,
} from "./pathologyExtractionProviderStub";
import {
  buildPathologyExtractionConfidenceSummary,
  clampConfidence,
  type PathologyExtractionProviderId,
  type PathologyPdfExtractionOutput,
} from "./pathologyExtractionProviderTypes";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const openAiMarkerSchema = z.object({
  markers: z.array(
    z.object({
      test_code: z.string().nullable().optional(),
      test_label: z.string(),
      result_value: z.string(),
      result_unit: z.string().nullable().optional(),
      reference_range: z.string().nullable().optional(),
      flag: z.string().nullable().optional(),
      confidence: z.number().nullable().optional(),
    })
  ),
  document_confidence: z.number().nullable().optional(),
});

function pathologyExtractionModel(env: PathologyExtractionProviderEnvSlice): string {
  return (
    env.OPENAI_PATHOLOGY_EXTRACTION_MODEL?.trim() ||
    env.OPENAI_CLINICAL_NOTE_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function finishExtractionOutput(params: {
  providerId: PathologyExtractionProviderId;
  requestedProviderId: PathologyExtractionProviderId;
  rawText: string;
  markers: RawPathologyExtractedMarker[];
  ocrConfidence: number | null;
  source: PathologyPdfExtractionOutput["source"];
  latencyMs: number;
  credentialPresent: boolean;
  externalRequestId?: string | null;
  fallbackReason?: string | null;
}): PathologyPdfExtractionOutput {
  const threshold = readPathologyExtractionMinOcrConfidenceFromEnv(params as PathologyExtractionProviderEnvSlice);
  const confidenceSummary = buildPathologyExtractionConfidenceSummary(
    params.markers,
    params.ocrConfidence,
    threshold
  );
  const requiresManualReview =
    params.markers.length === 0 ||
    !confidenceSummary.meets_threshold ||
    Boolean(params.fallbackReason);

  return {
    provider: params.providerId,
    rawText: params.rawText,
    markers: params.markers,
    ocrConfidence: params.ocrConfidence,
    source: params.source,
    skippedRawCount: 0,
    providerAudit: buildPathologyExtractionProviderAudit({
      providerId: params.providerId,
      requestedProviderId: params.requestedProviderId,
      outcome: requiresManualReview ? "fallback_manual_review" : "extracted",
      fallbackReason: params.fallbackReason,
      latencyMs: params.latencyMs,
      credentialPresent: params.credentialPresent,
      externalRequestId: params.externalRequestId,
    }),
    requiresManualReview,
    confidenceSummary,
  };
}

async function extractMarkersWithOpenAiFromText(
  rawText: string,
  env: PathologyExtractionProviderEnvSlice
): Promise<{
  markers: RawPathologyExtractedMarker[];
  documentConfidence: number | null;
  externalRequestId: string | null;
}> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: pathologyExtractionModel(env),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract blood pathology result markers from lab report text. Return strict JSON with keys markers (array) and document_confidence (0-1). Each marker: test_label, result_value, optional test_code, result_unit, reference_range, flag, confidence. Never invent values not present in the text.",
        },
        {
          role: "user",
          content: rawText.slice(0, 120_000),
        },
      ],
    }),
  });

  const rawJson = (await res.json()) as {
    id?: string;
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(rawJson.error?.message?.trim() || `OpenAI extraction HTTP ${res.status}`);
  }

  const content = rawJson.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI extraction returned empty content.");

  const parsed = openAiMarkerSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error("OpenAI extraction returned invalid marker JSON.");

  const markers: RawPathologyExtractedMarker[] = parsed.data.markers.map((m) => ({
    test_code: m.test_code ?? null,
    test_label: m.test_label,
    result_value: m.result_value,
    result_unit: m.result_unit ?? null,
    reference_range: m.reference_range ?? null,
    flag: m.flag ?? null,
    confidence:
      typeof m.confidence === "number" && Number.isFinite(m.confidence)
        ? clampConfidence(m.confidence)
        : null,
  }));

  const docConf =
    typeof parsed.data.document_confidence === "number" &&
    Number.isFinite(parsed.data.document_confidence)
      ? clampConfidence(parsed.data.document_confidence)
      : null;

  return {
    markers,
    documentConfidence: docConf,
    externalRequestId: rawJson.id?.trim() ?? null,
  };
}

/** OpenAI-compatible structured extraction from embedded PDF text. */
export class OpenAiPathologyExtractionProvider implements PathologyExtractionProviderAdapter {
  readonly providerId = "openai-vision-v1" as const;

  isConfigured(env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice): boolean {
    return isOpenAiPathologyExtractionConfigured(env);
  }

  async extractFromPdf(
    pdfBytes: Uint8Array,
    env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
  ): Promise<PathologyPdfExtractionOutput> {
    const started = Date.now();
    const requested = resolvePathologyExtractionProviderIdFromEnv(env);
    const credentialPresent = this.isConfigured(env);
    const rawText = extractPdfAsciiText(pdfBytes);

    if (!credentialPresent) {
      return buildManualReviewFallbackOutput({
        requestedProviderId: requested,
        providerId: this.providerId,
        rawText,
        reason: "OpenAI pathology extraction credentials are not configured.",
        latencyMs: Date.now() - started,
        credentialPresent: false,
      });
    }

    if (rawText.trim().length < 40) {
      return buildManualReviewFallbackOutput({
        requestedProviderId: requested,
        providerId: this.providerId,
        rawText,
        reason:
          "Insufficient embedded PDF text for OpenAI extraction; scanned documents require vendor OCR wiring.",
        latencyMs: Date.now() - started,
        credentialPresent: true,
      });
    }

    try {
      const { markers, documentConfidence, externalRequestId } =
        await extractMarkersWithOpenAiFromText(rawText, env);

      if (markers.length === 0) {
        const secondary = parseMarkersFromExtractedText(rawText, "ocr_openai");
        return finishExtractionOutput({
          providerId: this.providerId,
          requestedProviderId: requested,
          rawText,
          markers: secondary.markers,
          ocrConfidence: secondary.ocrConfidence ?? documentConfidence,
          source: secondary.markers.length > 0 ? "ocr_openai" : "provider_fallback",
          latencyMs: Date.now() - started,
          credentialPresent: true,
          externalRequestId,
          fallbackReason:
            secondary.markers.length === 0
              ? "OpenAI returned no markers; routed to manual review."
              : null,
        });
      }

      return finishExtractionOutput({
        providerId: this.providerId,
        requestedProviderId: requested,
        rawText,
        markers,
        ocrConfidence: documentConfidence,
        source: "ocr_openai",
        latencyMs: Date.now() - started,
        credentialPresent: true,
        externalRequestId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenAI extraction failed.";
      return buildManualReviewFallbackOutput({
        requestedProviderId: requested,
        providerId: this.providerId,
        rawText,
        reason: message,
        latencyMs: Date.now() - started,
        credentialPresent: true,
        outcome: "provider_error",
      });
    }
  }
}

/** AWS Textract adapter shell — credentials gate + embedded-text fallback until OCR wiring lands. */
export class AwsTextractPathologyExtractionProvider implements PathologyExtractionProviderAdapter {
  readonly providerId = "aws-textract-v1" as const;

  isConfigured(env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice): boolean {
    return isAwsTextractPathologyExtractionConfigured(env);
  }

  async extractFromPdf(
    pdfBytes: Uint8Array,
    env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
  ): Promise<PathologyPdfExtractionOutput> {
    const started = Date.now();
    const requested = resolvePathologyExtractionProviderIdFromEnv(env);
    const credentialPresent = this.isConfigured(env);
    const rawText = extractPdfAsciiText(pdfBytes);

    if (!credentialPresent) {
      return buildManualReviewFallbackOutput({
        requestedProviderId: requested,
        providerId: this.providerId,
        rawText,
        reason: "AWS Textract credentials are not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).",
        latencyMs: Date.now() - started,
        credentialPresent: false,
      });
    }

    const parsed = parseMarkersFromExtractedText(rawText, "ocr_textract");
    return finishExtractionOutput({
      providerId: this.providerId,
      requestedProviderId: requested,
      rawText,
      markers: parsed.markers,
      ocrConfidence: parsed.ocrConfidence,
      source: parsed.markers.length > 0 ? "ocr_textract" : "provider_fallback",
      latencyMs: Date.now() - started,
      credentialPresent: true,
      fallbackReason:
        parsed.markers.length > 0
          ? "Textract OCR shell active — using embedded PDF text until AnalyzeDocument wiring ships."
          : "Textract OCR shell active — no markers found; manual review required.",
    });
  }
}

/** Google Cloud Vision adapter shell — credentials gate + embedded-text fallback. */
export class GoogleVisionPathologyExtractionProvider implements PathologyExtractionProviderAdapter {
  readonly providerId = "google-vision-v1" as const;

  isConfigured(env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice): boolean {
    return isGoogleVisionPathologyExtractionConfigured(env);
  }

  async extractFromPdf(
    pdfBytes: Uint8Array,
    env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
  ): Promise<PathologyPdfExtractionOutput> {
    const started = Date.now();
    const requested = resolvePathologyExtractionProviderIdFromEnv(env);
    const credentialPresent = this.isConfigured(env);
    const rawText = extractPdfAsciiText(pdfBytes);

    if (!credentialPresent) {
      return buildManualReviewFallbackOutput({
        requestedProviderId: requested,
        providerId: this.providerId,
        rawText,
        reason:
          "Google Vision credentials are not configured (GOOGLE_CLOUD_VISION_API_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON).",
        latencyMs: Date.now() - started,
        credentialPresent: false,
      });
    }

    const parsed = parseMarkersFromExtractedText(rawText, "ocr_vision");
    return finishExtractionOutput({
      providerId: this.providerId,
      requestedProviderId: requested,
      rawText,
      markers: parsed.markers,
      ocrConfidence: parsed.ocrConfidence,
      source: parsed.markers.length > 0 ? "ocr_vision" : "provider_fallback",
      latencyMs: Date.now() - started,
      credentialPresent: true,
      fallbackReason:
        parsed.markers.length > 0
          ? "Vision OCR shell active — using embedded PDF text until Document OCR wiring ships."
          : "Vision OCR shell active — no markers found; manual review required.",
    });
  }
}

const LIVE_ADAPTERS: Record<
  Exclude<PathologyExtractionProviderId, "fi-pathology-stub-v1">,
  PathologyExtractionProviderAdapter
> = {
  "openai-vision-v1": new OpenAiPathologyExtractionProvider(),
  "aws-textract-v1": new AwsTextractPathologyExtractionProvider(),
  "google-vision-v1": new GoogleVisionPathologyExtractionProvider(),
};

export function getLivePathologyExtractionAdapter(
  providerId: PathologyExtractionProviderId
): PathologyExtractionProviderAdapter | null {
  if (providerId === "fi-pathology-stub-v1") return null;
  return LIVE_ADAPTERS[providerId] ?? null;
}

let productionProvidersRegistered = false;

/** Idempotent server bootstrap — no-op placeholder for import side-effects parity with ReceptionOS. */
export function ensurePathologyExtractionProductionProviders(): void {
  productionProvidersRegistered = true;
}

export function isPathologyExtractionProductionProvidersRegistered(): boolean {
  return productionProvidersRegistered;
}

ensurePathologyExtractionProductionProviders();
