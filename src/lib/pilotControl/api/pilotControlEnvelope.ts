/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — response envelope builders (pure).
 */

import {
  BLOCKER_EVALUATION_VERSION,
  PILOT_CONTROL_API_VERSION,
  PILOT_HEALTH_RULE_VERSION,
} from "../pilotControlContracts";
import { READINESS_EVALUATION_VERSION } from "../readiness/readinessTypes";
import type {
  PilotControlApiResponse,
  PilotControlApiWarning,
  PilotControlPaginatedResponse,
  PilotControlPagination,
  PilotControlResponseMetadata,
  PilotEvaluationMetadata,
} from "./pilotControlApiTypes";

export function buildEvaluationMetadata(args: {
  evaluatedAt?: string;
  oldestSourceUpdatedAt?: string;
  staleSources?: string[];
  blockerPersistenceMode?: PilotEvaluationMetadata["blockerPersistenceMode"];
}): PilotEvaluationMetadata {
  return {
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    readinessVersion: READINESS_EVALUATION_VERSION,
    blockerVersion: BLOCKER_EVALUATION_VERSION,
    healthVersion: PILOT_HEALTH_RULE_VERSION,
    oldestSourceUpdatedAt: args.oldestSourceUpdatedAt,
    staleSources: args.staleSources ?? [],
    blockerPersistenceMode: args.blockerPersistenceMode ?? "read_only",
  };
}

export function buildResponseMeta(args: {
  programmeId: string;
  tenantId: string;
  correlationId: string;
  generatedAt?: string;
  sourceFreshnessAt?: string;
  partial?: boolean;
  warnings?: PilotControlApiWarning[];
  evaluation?: PilotEvaluationMetadata;
}): PilotControlResponseMetadata {
  return {
    apiVersion: PILOT_CONTROL_API_VERSION,
    evaluationVersion: READINESS_EVALUATION_VERSION,
    programmeId: args.programmeId,
    tenantId: args.tenantId,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    sourceFreshnessAt: args.sourceFreshnessAt,
    correlationId: args.correlationId,
    partial: args.partial ?? false,
    warnings: args.warnings ?? [],
    evaluation: args.evaluation ?? buildEvaluationMetadata({}),
  };
}

export function wrapPilotControlResponse<T>(
  data: T,
  meta: PilotControlResponseMetadata
): PilotControlApiResponse<T> {
  return { data, meta };
}

export function wrapPilotControlPaginatedResponse<T>(
  data: T[],
  pagination: PilotControlPagination,
  meta: PilotControlResponseMetadata
): PilotControlPaginatedResponse<T> {
  return { data, pagination, meta };
}
