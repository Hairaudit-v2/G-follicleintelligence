/**
 * SharedProjectionProvider adapter for openai-gpt-image.
 * Relocated from HairAudit openaiGptImageProvider — single implementation in ImagingOS.
 */

import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import type { ImageEditParamsNonStreaming } from "openai/resources/images";
import sharp from "sharp";
import type {
  SharedProjectionProvider,
  SharedProjectionProviderGenerateResult,
  SharedProjectionProviderHealth,
  SharedProjectionRequestV1,
} from "@follicle/projection-core/client";
import { compositeOutcomeWithinMask, normalizeProjectionRaster } from "./maskContainmentComposite";
import {
  computeAspectFitLayout,
  padImageToCanvas,
  parseOpenAiEditSize,
  pickOpenAiEditSize,
  unpadCanvasToSource,
} from "./openaiEditGeometry";
import {
  buildOpenAiProjectedOutcomeEditPrompt,
  OPENAI_EDIT_PROMPT_VERSION_V3,
  type SharedEditPromptAssumptions,
} from "./openaiEditPrompt";
import { validateProjectedOutcomeAsset } from "./outcomeValidation";
import {
  SHARED_PROJECTION_PROVIDER_ID,
  type SharedProjectionOutputQuality,
} from "../providerConfig";

export const OPENAI_GPT_IMAGE_PROVIDER_ID = SHARED_PROJECTION_PROVIDER_ID;
export const OPENAI_GPT_IMAGE_MODEL_DEFAULT = "gpt-image-2" as const;

export type OpenAiSharedProviderOptions = {
  apiKey: string;
  model?: string;
  quality?: SharedProjectionOutputQuality;
  outputFormat?: "png" | "jpeg" | "webp";
  client?: OpenAI;
  timeoutMs?: number;
  promptTemplateVersion?: string;
};

function classifyOpenAiFailure(err: unknown): {
  failureCategory:
    | "provider_timeout"
    | "provider_error"
    | "unsupported_request"
    | "implementation_failure";
  message: string;
  retryable: boolean;
} {
  const anyErr = err as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    error?: { code?: string; type?: string; message?: string };
  };
  const status = anyErr?.status;
  const code = String(anyErr?.error?.code ?? anyErr?.code ?? "").toLowerCase();
  const type = String(anyErr?.error?.type ?? anyErr?.type ?? "").toLowerCase();
  const message = String(anyErr?.error?.message ?? anyErr?.message ?? "OpenAI image edit failed");

  if (status === 401 || code.includes("invalid_api_key") || code.includes("authentication")) {
    return { failureCategory: "provider_error", message, retryable: false };
  }
  if (status === 400 || type.includes("invalid_request")) {
    return { failureCategory: "unsupported_request", message, retryable: false };
  }
  if (status === 408 || status === 429 || status === 500 || status === 502 || status === 503) {
    return {
      failureCategory: status === 408 ? "provider_timeout" : "provider_error",
      message,
      retryable: true,
    };
  }
  return { failureCategory: "implementation_failure", message, retryable: true };
}

function assumptionsFromRequest(request: SharedProjectionRequestV1): SharedEditPromptAssumptions {
  const grafts = request.graftAllocationsByZone.reduce((s, z) => s + (z.grafts || 0), 0);
  const hairs = request.hairCharacteristics.hairsPerGraftAssumption ?? 2.2;
  return {
    graftCount: grafts || 0,
    assumedGraftSurvivalRangePct: { min: 85, max: 95 },
    hairsPerGraftAssumption: hairs,
    projectedDensityRange: { minPerCm2: 25, maxPerCm2: 45 },
  };
}

export function buildOpenAiProjectedOutcomeStoragePath(input: {
  tenantId: string;
  generationId: string;
  outputChecksum: string;
  extension?: string;
}): string {
  const ext = input.extension ?? "jpg";
  return `shared_projections/${input.tenantId}/${input.generationId}/illustrative_projected_outcome/${input.outputChecksum.slice(0, 16)}.${ext}`;
}

export function createOpenAiGptImageSharedProvider(
  options: OpenAiSharedProviderOptions
): SharedProjectionProvider {
  const model = (options.model ?? OPENAI_GPT_IMAGE_MODEL_DEFAULT).trim() || OPENAI_GPT_IMAGE_MODEL_DEFAULT;
  const client =
    options.client ??
    new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs ?? 180_000,
    });

  return {
    providerId: OPENAI_GPT_IMAGE_PROVIDER_ID,
    supportedArtifactTypes: ["illustrative_projected_outcome"],

    async healthcheck(): Promise<SharedProjectionProviderHealth> {
      const configured = Boolean(options.apiKey || options.client);
      return {
        healthy: configured,
        configured,
        detail: configured
          ? `${OPENAI_GPT_IMAGE_PROVIDER_ID} / ${model} ready`
          : "OPENAI_API_KEY missing",
        realProviderConnected: configured,
      };
    },

    async generate(
      request: SharedProjectionRequestV1,
      deps: {
        loadSourceBytes: (ref: string) => Promise<Uint8Array>;
        loadMaskBytes: (ref: string) => Promise<Uint8Array>;
        abortSignal?: AbortSignal;
      }
    ): Promise<SharedProjectionProviderGenerateResult> {
      if (request.artifactType !== "illustrative_projected_outcome") {
        return {
          ok: false,
          failureCategory: "unsupported_request",
          message: "Provider only emits illustrative_projected_outcome",
          retryable: false,
        };
      }
      if (!options.apiKey && !options.client) {
        return {
          ok: false,
          failureCategory: "provider_disabled",
          message: "OPENAI_API_KEY is not configured",
          retryable: false,
        };
      }

      let sourceBytes: Buffer;
      let treatmentMaskBytes: Buffer;
      let hardMaskBytes: Buffer;
      try {
        sourceBytes = Buffer.from(await deps.loadSourceBytes(request.sourceImageRef));
        treatmentMaskBytes = Buffer.from(await deps.loadMaskBytes(request.treatmentMaskRef));
        hardMaskBytes = request.preservationMaskRef
          ? Buffer.from(await deps.loadMaskBytes(request.preservationMaskRef))
          : treatmentMaskBytes;
      } catch (e) {
        return {
          ok: false,
          failureCategory: "source_image_unavailable",
          message: e instanceof Error ? e.message : "Could not load source or mask",
          retryable: true,
        };
      }

      const sourceChecksum = createHash("sha256").update(sourceBytes).digest("hex");
      if (
        request.sourceImageChecksum &&
        sourceChecksum !== request.sourceImageChecksum
      ) {
        return {
          ok: false,
          failureCategory: "unsupported_request",
          message: "Source image checksum mismatch",
          retryable: false,
        };
      }

      const maskChecksum = createHash("sha256").update(treatmentMaskBytes).digest("hex");
      if (
        request.treatmentMaskChecksum &&
        maskChecksum !== request.treatmentMaskChecksum
      ) {
        return {
          ok: false,
          failureCategory: "mask_invalid",
          message: "Treatment mask checksum mismatch",
          retryable: false,
        };
      }

      const normalized = await normalizeProjectionRaster(sourceBytes);
      const workingSource = normalized.png;
      const assumptions = assumptionsFromRequest(request);
      const zonesIncluded = request.graftAllocationsByZone
        .filter((z) => z.grafts > 0 && !z.deferred)
        .map((z) => z.zoneKey);
      const { prompt, promptVersion } = buildOpenAiProjectedOutcomeEditPrompt({
        zonesIncluded,
        planVersion: request.approvedSurgicalPlanVersion,
        assumptions,
        mode: "planned",
      });

      const size = pickOpenAiEditSize(normalized.widthPx, normalized.heightPx);
      const canvas = parseOpenAiEditSize(size);
      if (!canvas) {
        return {
          ok: false,
          failureCategory: "implementation_failure",
          message: "Could not resolve OpenAI edit canvas size",
          retryable: false,
        };
      }
      const layout = computeAspectFitLayout({
        sourceWidth: normalized.widthPx,
        sourceHeight: normalized.heightPx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });

      try {
        const paddedSource = await padImageToCanvas({
          bytes: workingSource,
          layout,
          background: { r: 0, g: 0, b: 0, alpha: 255 },
        });
        const paddedMask = await padImageToCanvas({
          bytes: treatmentMaskBytes,
          layout,
          background: { r: 0, g: 0, b: 0, alpha: 255 },
        });

        const imageFile = await toFile(paddedSource, "source.png", { type: "image/png" });
        const maskFile = await toFile(paddedMask, "mask.png", { type: "image/png" });

        const editParams: ImageEditParamsNonStreaming = {
          model,
          image: imageFile,
          mask: maskFile,
          prompt,
          n: 1,
          quality: options.quality ?? "high",
          output_format: options.outputFormat ?? "jpeg",
          size,
          stream: false,
        };

        const response = await client.images.edit(editParams, {
          signal: deps.abortSignal,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) {
          return {
            ok: false,
            failureCategory: "provider_error",
            message: "OpenAI image edit returned no image data",
            retryable: true,
          };
        }

        let outputBytes: Buffer = Buffer.from(b64, "base64");
        const responseMeta = await sharp(outputBytes).metadata();
        const responseW = responseMeta.width ?? 0;
        const responseH = responseMeta.height ?? 0;
        if (responseW === layout.canvasWidth && responseH === layout.canvasHeight) {
          const unpadded = await unpadCanvasToSource({
            bytes: outputBytes,
            layout,
            outputFormat: "jpeg",
          });
          outputBytes = unpadded.bytes;
        } else if (
          responseW > 0 &&
          responseH > 0 &&
          Math.abs(responseW / responseH - normalized.widthPx / normalized.heightPx) < 0.02
        ) {
          outputBytes = await sharp(outputBytes)
            .resize(normalized.widthPx, normalized.heightPx, {
              fit: "fill",
              kernel: "lanczos3",
            })
            .jpeg({ quality: 90, mozjpeg: true })
            .toBuffer();
        } else {
          return {
            ok: false,
            failureCategory: "unsupported_request",
            message: `OpenAI returned ${responseW}x${responseH}; cannot restore source aspect without shear`,
            retryable: true,
          };
        }

        const contained = await compositeOutcomeWithinMask({
          sourceBytes: workingSource,
          modelOutputBytes: outputBytes,
          maskPng: hardMaskBytes,
        });
        outputBytes = contained.bytes;

        const outMeta = await sharp(outputBytes).metadata();
        const outputChecksum = createHash("sha256").update(outputBytes).digest("hex");
        const validation = await validateProjectedOutcomeAsset({
          sourceBytes: workingSource,
          outputBytes,
          maskPng: hardMaskBytes,
          maskChecksum: request.treatmentMaskChecksum || maskChecksum,
          expectedMime: "image/jpeg",
        });

        if (!validation.ok && validation.route === "technically_rejected") {
          return {
            ok: false,
            failureCategory:
              validation.code === "identity_or_containment_failed"
                ? "identity_or_containment_failed"
                : "validation_failed",
            message: validation.message,
            retryable: false,
            providerGenerationId:
              (response as { _request_id?: string })._request_id ?? null,
          };
        }

        const warnings =
          !validation.ok && validation.measurements?.seamFlags?.length
            ? validation.measurements.seamFlags
            : [];

        return {
          ok: true,
          providerGenerationId:
            (response as { _request_id?: string })._request_id ?? outputChecksum.slice(0, 24),
          modelVersion: model,
          promptTemplateVersion: options.promptTemplateVersion ?? promptVersion,
          outputBytes: new Uint8Array(outputBytes),
          mimeType: "image/jpeg",
          widthPx: outMeta.width ?? contained.widthPx,
          heightPx: outMeta.height ?? contained.heightPx,
          outputChecksum,
          technicalValidation: {
            ...validation.technicalValidation,
            overallPass: validation.ok,
          },
          limitations: [
            "Illustrative projected outcome only — clinician review required.",
            "OpenAI mask adherence is guidance-based; out-of-mask pixels restored from source.",
            "Patient sharing unavailable.",
            ...warnings,
          ],
          planningAssumptions: [
            `provider=${OPENAI_GPT_IMAGE_PROVIDER_ID}`,
            `model=${model}`,
            `promptVersion=${OPENAI_EDIT_PROMPT_VERSION_V3}`,
            `graftCount=${assumptions.graftCount}`,
            `mode=planned`,
            `zones=${zonesIncluded.join(",")}`,
            `sourceChecksum=${sourceChecksum}`,
            `maskChecksum=${maskChecksum}`,
            `containmentComposite=true`,
            `editCanvas=${size}`,
            `validationRoute=${validation.route}`,
          ],
        };
      } catch (e) {
        const classified = classifyOpenAiFailure(e);
        return {
          ok: false,
          failureCategory: classified.failureCategory,
          message: classified.message,
          retryable: classified.retryable,
        };
      }
    },
  };
}
