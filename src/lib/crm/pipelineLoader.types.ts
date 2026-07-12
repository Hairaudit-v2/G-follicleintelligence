/**
 * FI-UX-REBUILD-1 S4.4 — Pipeline loader input/output contracts (pure types).
 */

import type { PipelineMoveStageDefinition } from "@/src/lib/crm/pipelineMoveTarget";
import type { PipelinePresentation } from "@/src/lib/crm/pipelinePresentation.types";

export type PipelineResolvedPermissions = {
  canView: boolean;
  canMutate: boolean;
  canConvert: boolean;
  canBookConsultation: boolean;
  canCreateEnquiry: boolean;
};

export type PipelineShellPayload = {
  presentation: PipelinePresentation;
  tenantStages: PipelineMoveStageDefinition[];
  permissions: PipelineResolvedPermissions;
  currentUserId: string | null;
  generatedAt: string;
};

export type PipelineFullPayload = {
  presentation: PipelinePresentation;
  generatedAt: string;
};

/** Future query boundary — server vs client filter split (S4.5). */
export type PipelineQueryState = {
  view: "board" | "follow_ups";
  staffColumnIds: string[];
  backendStageSlugs: string[];
  ownerIds: string[];
  sourceKeys: string[];
  urgencyFlags: string[];
  lifecycle: "active" | "holding" | "terminal" | null;
  search: string | null;
};

export type PipelineTierIdentityResult =
  | { ok: true }
  | {
      ok: false;
      missingFromFull: string[];
      extraInFull: string[];
    };
