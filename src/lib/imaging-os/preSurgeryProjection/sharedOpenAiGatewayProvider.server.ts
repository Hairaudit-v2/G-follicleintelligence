/**
 * Adapts HairAudit gateway calls onto SharedProjectionProvider / generationService.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { requestSharedIllustrativeGeneration } from "@/src/lib/imaging-os/sharedProjection/generationService.server";
import {
  resolveSharedProjectionProviderConfig,
  SHARED_PROJECTION_PROVIDER_ID,
} from "@/src/lib/imaging-os/sharedProjection/providerConfig";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSharedProjectionStorageDeps } from "@/src/lib/imaging-os/sharedProjection/openai";
import type {
  PreSurgeryProjectionProvider,
  ProjectionProviderGenerateInput,
  ProjectionProviderGenerateResult,
  ProjectionProviderHealth,
} from "./provider";

export function createSharedOpenAiGatewayProvider(): PreSurgeryProjectionProvider {
  const config = resolveSharedProjectionProviderConfig();

  return {
    name: SHARED_PROJECTION_PROVIDER_ID,
    modelVersion: config.model,

    async healthcheck(): Promise<ProjectionProviderHealth> {
      return {
        healthy: config.mayInvokeProvider,
        configured: config.apiKeyConfigured,
        detail: config.mayInvokeProvider
          ? `${SHARED_PROJECTION_PROVIDER_ID} / ${config.model} shared path ready`
          : config.configurationError ?? "shared provider gated",
      };
    },

    async generateProjection(
      input: ProjectionProviderGenerateInput
    ): Promise<ProjectionProviderGenerateResult> {
      const live = resolveSharedProjectionProviderConfig();
      if (!live.mayInvokeProvider) {
        return {
          ok: false,
          errorCode: live.configurationError ?? "provider_disabled",
          message: "Shared openai-gpt-image provider is not enabled",
          retryable: false,
        };
      }

      const tenantId = [...live.pilotTenantIds][0];
      if (!tenantId) {
        return {
          ok: false,
          errorCode: "pilot_tenant_allowlist_empty",
          message: "No pilot tenant allowlisted",
          retryable: false,
        };
      }

      if (input.mode !== "planned") {
        return {
          ok: false,
          errorCode: "unsupported_request",
          message: "Pilot shared path only accepts planned mode",
          retryable: false,
        };
      }

      const zones = (input.canonical?.geometry?.zoneGraftTargets ?? []).map(
        (z: { zone: string; grafts: number; priority: string }) => ({
          key: z.zone,
          grafts: z.grafts,
          deferred: z.priority === "defer",
          polygonNorm: null as Array<{ x: number; y: number }> | null,
        })
      );

      const result = await requestSharedIllustrativeGeneration({
        tenantId,
        patientSubjectRef: `ha:${input.caseId}`,
        fiosCaseId: null,
        hairauditCaseRef: input.caseId,
        surgicalPlanId: input.approvedGraftPlanId,
        surgicalPlanVersion: input.approvedGraftPlanVersion,
        hairlineDesignId: input.approvedGraftPlanId,
        hairlineDesignVersion: input.approvedGraftPlanVersion,
        sourceImageRef: input.sourceImageRef,
        sourceImageChecksum: input.inputChecksum,
        sourceView: "frontal",
        treatmentMaskChecksum: input.inputChecksum,
        projectionMode: "planned",
        providerId: SHARED_PROJECTION_PROVIDER_ID,
        modelVersion: live.model,
        promptTemplateVersion: live.promptTemplateVersion,
        requestingProduct: "hairaudit",
        correlationId: input.jobId || randomUUID(),
        planApproved: true,
        hairlineApproved: true,
        zones,
        graftAllocationsByZone: zones.map((z) => ({
          zoneKey: z.key,
          grafts: typeof z.grafts === "number" ? z.grafts : 0,
          targetDensityPerCm2: null,
          deferred: Boolean(z.deferred),
          unassessed: false,
          priority: null,
        })),
        confirmPaidGeneration: true,
      });

      if (!result.ok) {
        return {
          ok: false,
          errorCode: result.code,
          message: result.message,
          retryable:
            result.failureCategory === "provider_timeout" ||
            result.failureCategory === "provider_error",
        };
      }

      if (result.kind === "idempotent_hit" && result.generation?.outputStorageRef) {
        const storage = createSharedProjectionStorageDeps(supabaseAdmin());
        const bytes = await storage.loadBytes(result.generation.outputStorageRef);
        return {
          ok: true,
          providerRequestId: result.generation.id,
          providerResponseId: result.generation.id,
          modelVersion: live.model,
          outputBytes: Buffer.from(bytes),
          mimeType: "image/jpeg",
          limitations: [
            "Shared generation idempotent hit — no additional provider charge.",
            `sharedGenerationId=${result.generation.id}`,
          ],
          planningAssumptions: [`sharedGenerationId=${result.generation.id}`],
        };
      }

      if (result.kind === "generated" && result.generation?.outputStorageRef) {
        const storage = createSharedProjectionStorageDeps(supabaseAdmin());
        const bytes = await storage.loadBytes(result.generation.outputStorageRef);
        return {
          ok: true,
          providerRequestId: result.generation.id,
          providerResponseId: result.generation.id,
          modelVersion: live.model,
          outputBytes: Buffer.from(bytes),
          mimeType: "image/jpeg",
          limitations:
            result.response && "warnings" in result.response ? result.response.warnings : [],
          planningAssumptions: [`sharedGenerationId=${result.generation.id}`],
        };
      }

      return {
        ok: false,
        errorCode: "ready_for_controlled_pilot",
        message: "Shared provider preflight complete; paid generation not confirmed",
        retryable: false,
      };
    },
  };
}
