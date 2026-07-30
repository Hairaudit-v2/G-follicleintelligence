/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Clinic channel service interface for 1B.
 *
 * 1B should import from this module (and domain/jobs/storage/providerRegistry) rather than
 * duplicating gateway logic. Routes/UI are intentionally not built in 1A.
 */

import "server-only";

import type {
  ApproveProjectionCommand,
  MarkProjectionStaleCommand,
  RejectProjectionCommand,
  RegenerateProjectionCommand,
} from "./domain.server";
import {
  evaluateApprovalEligibility,
  evaluatePatientSharingEligibility,
} from "./domain.server";
import { resolveProjectionGatewayConfig } from "./config.server";
import { ProjectionGatewayError } from "./errors";
import type { ProjectionJobStore } from "./jobs.server";
import type { ProjectionJobRecord } from "./types";
import { resolveClinicTenantProvenance } from "./tenantMapping.server";

export type ClinicProjectionService = {
  /** Shared generation entry — same provider/job/storage stack as HairAudit gateway. */
  requestProjection: (input: {
    tenantId: string;
    clinicId: string;
    patientId?: string | null;
    caseId: string;
    procedureId?: string | null;
    idempotencyKey: string;
    // Full clinic payload wiring arrives in 1B.
  }) => Promise<{ accepted: false; reason: string }>;
  approve: (cmd: ApproveProjectionCommand, store: ProjectionJobStore) => Promise<ProjectionJobRecord>;
  reject: (cmd: RejectProjectionCommand, store: ProjectionJobStore) => Promise<ProjectionJobRecord>;
  markStale: (cmd: MarkProjectionStaleCommand, store: ProjectionJobStore) => Promise<ProjectionJobRecord>;
  evaluateRegeneration: (cmd: RegenerateProjectionCommand) => { ok: boolean; code?: string };
};

export function createClinicProjectionService(): ClinicProjectionService {
  return {
    async requestProjection(input) {
      const config = resolveProjectionGatewayConfig();
      try {
        resolveClinicTenantProvenance({
          tenantId: input.tenantId,
          clinicId: input.clinicId,
          patientId: input.patientId,
          caseId: input.caseId,
          procedureId: input.procedureId,
          config,
        });
      } catch (e) {
        if (e instanceof ProjectionGatewayError) {
          return { accepted: false, reason: e.code };
        }
        throw e;
      }
      return {
        accepted: false,
        reason:
          "FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1B — clinic request surface not enabled in 1A",
      };
    },
    async approve(cmd, store) {
      const job = await store.getById(cmd.jobId);
      if (!job) throw new ProjectionGatewayError("job_not_found", "Job not found", 404);
      if (job.tenantId !== cmd.tenantId || job.clinicId !== cmd.clinicId) {
        throw new ProjectionGatewayError("cross_case_denied", "Tenant/clinic mismatch", 403);
      }
      const eligibility = evaluateApprovalEligibility(job);
      if (!eligibility.ok) {
        throw new ProjectionGatewayError(
          "validation_failed",
          eligibility.code ?? "not_eligible",
          409
        );
      }
      return store.update(job.id, {
        clinicianReviewState: "approved",
        patientVisibilityEligibility: "eligible_after_approval",
      });
    },
    async reject(cmd, store) {
      const job = await store.getById(cmd.jobId);
      if (!job) throw new ProjectionGatewayError("job_not_found", "Job not found", 404);
      if (job.tenantId !== cmd.tenantId || job.clinicId !== cmd.clinicId) {
        throw new ProjectionGatewayError("cross_case_denied", "Tenant/clinic mismatch", 403);
      }
      return store.update(job.id, {
        clinicianReviewState: "rejected",
        patientVisibilityEligibility: "ineligible",
        errorCode: cmd.reasonCode,
        errorMessageSafe: cmd.note ?? "Rejected by clinician",
      });
    },
    async markStale(cmd, store) {
      const job = await store.getById(cmd.jobId);
      if (!job) throw new ProjectionGatewayError("job_not_found", "Job not found", 404);
      if (job.tenantId !== cmd.tenantId) {
        throw new ProjectionGatewayError("cross_case_denied", "Tenant mismatch", 403);
      }
      return store.update(job.id, {
        patientVisibilityEligibility: "ineligible",
      });
    },
    evaluateRegeneration() {
      return { ok: true };
    },
  };
}

export { evaluateApprovalEligibility, evaluatePatientSharingEligibility };
