/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Stub provider (dev/test only).
 * Never claim stub output came from a real generative model.
 */

import "server-only";

import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type {
  PreSurgeryProjectionProvider,
  ProjectionProviderGenerateInput,
  ProjectionProviderGenerateResult,
  ProjectionProviderHealth,
} from "./provider";

const STUB_LIMITATIONS = [
  "STUB PROVIDER — not a clinical generative model.",
  "Illustrative placeholder only — not a guarantee of density, growth, survival, or final appearance.",
  "Do not present this output to patients as a real surgical projection.",
];

const STUB_ASSUMPTIONS = [
  "Stub output is a deterministic placeholder image for gateway/integration testing.",
  "No facial identity transform or hair-fill synthesis was performed.",
];

export function createStubPreSurgeryProjectionProvider(): PreSurgeryProjectionProvider {
  return {
    name: "stub",
    modelVersion: "stub-v1",
    async healthcheck(): Promise<ProjectionProviderHealth> {
      return { healthy: true, detail: "stub_ready", configured: true };
    },
    async generateProjection(
      input: ProjectionProviderGenerateInput
    ): Promise<ProjectionProviderGenerateResult> {
      if (input.abortSignal?.aborted) {
        return {
          ok: false,
          errorCode: "provider_cancelled",
          message: "Projection cancelled",
          retryable: false,
        };
      }

      const seed = input.deterministicSeed ?? input.inputChecksum ?? input.jobId;
      const hue = createHash("sha256").update(seed).digest().readUInt8(0);
      const png = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 3,
          background: { r: 40 + (hue % 80), g: 60, b: 90 },
        },
      })
        .png()
        .toBuffer();

      const providerRequestId = `stub-req-${randomUUID()}`;
      const providerResponseId = `stub-res-${createHash("sha256")
        .update(`${input.jobId}:${seed}`)
        .digest("hex")
        .slice(0, 24)}`;

      return {
        ok: true,
        providerRequestId,
        providerResponseId,
        modelVersion: "stub-v1",
        outputBytes: png,
        mimeType: "image/png",
        limitations: [...STUB_LIMITATIONS],
        planningAssumptions: [...STUB_ASSUMPTIONS],
      };
    },
  };
}
