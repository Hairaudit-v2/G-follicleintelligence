/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Job persistence + lifecycle.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ClinicianReviewState,
  PatientVisibilityEligibility,
  ProjectionJobRecord,
  ProjectionJobStatus,
  ProjectionMode,
  ProjectionSourceChannel,
} from "./types";

export type CreateProjectionJobInput = {
  sourceChannel: ProjectionSourceChannel;
  serviceSource: string;
  tenantId: string;
  clinicId: string;
  caseId: string;
  externalCaseId: string | null;
  externalProjectionId: string | null;
  patientId: string | null;
  procedureId: string | null;
  idempotencyKey: string;
  inputChecksum: string;
  schemaVersion: string;
  mode: ProjectionMode;
  modelVersion: string;
  requestPayloadChecksum: string;
  providerName: string;
  immutableSnapshot: Record<string, unknown> | null;
};

function mapRow(row: Record<string, unknown>): ProjectionJobRecord {
  return {
    id: String(row.id),
    sourceChannel: row.source_channel as ProjectionSourceChannel,
    serviceSource: String(row.service_source),
    tenantId: String(row.tenant_id),
    clinicId: String(row.clinic_id),
    caseId: String(row.case_id),
    externalCaseId: row.external_case_id != null ? String(row.external_case_id) : null,
    externalProjectionId:
      row.external_projection_id != null ? String(row.external_projection_id) : null,
    patientId: row.patient_id != null ? String(row.patient_id) : null,
    procedureId: row.procedure_id != null ? String(row.procedure_id) : null,
    idempotencyKey: String(row.idempotency_key),
    inputChecksum: String(row.input_checksum),
    schemaVersion: String(row.schema_version),
    mode: row.mode as ProjectionMode,
    modelVersion: String(row.model_version),
    status: row.status as ProjectionJobStatus,
    requestPayloadChecksum: String(row.request_payload_checksum),
    providerName: String(row.provider_name),
    providerRequestId: row.provider_request_id != null ? String(row.provider_request_id) : null,
    providerResponseId:
      row.provider_response_id != null ? String(row.provider_response_id) : null,
    outputStorageRef: row.output_storage_ref != null ? String(row.output_storage_ref) : null,
    outputChecksum: row.output_checksum != null ? String(row.output_checksum) : null,
    errorCode: row.error_code != null ? String(row.error_code) : null,
    errorMessageSafe: row.error_message_safe != null ? String(row.error_message_safe) : null,
    attemptCount: Number(row.attempt_count ?? 0),
    clinicianReviewState: (row.clinician_review_state as ClinicianReviewState) ?? "not_applicable",
    patientVisibilityEligibility:
      (row.patient_visibility_eligibility as PatientVisibilityEligibility) ?? "ineligible",
    supersededByJobId:
      row.superseded_by_job_id != null ? String(row.superseded_by_job_id) : null,
    staleReason: row.stale_reason != null ? String(row.stale_reason) : null,
    immutableSnapshot:
      row.immutable_snapshot && typeof row.immutable_snapshot === "object"
        ? (row.immutable_snapshot as Record<string, unknown>)
        : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
  };
}

export interface ProjectionJobStore {
  findByIdempotency(input: {
    serviceSource: string;
    caseId: string;
    idempotencyKey: string;
  }): Promise<ProjectionJobRecord | null>;
  insert(input: CreateProjectionJobInput): Promise<ProjectionJobRecord>;
  update(
    id: string,
    patch: Partial<{
      status: ProjectionJobStatus;
      providerRequestId: string | null;
      providerResponseId: string | null;
      outputStorageRef: string | null;
      outputChecksum: string | null;
      errorCode: string | null;
      errorMessageSafe: string | null;
      attemptCount: number;
      clinicianReviewState: ClinicianReviewState;
      patientVisibilityEligibility: PatientVisibilityEligibility;
      completedAt: string | null;
      externalProjectionId: string | null;
    }>
  ): Promise<ProjectionJobRecord>;
  getById(id: string): Promise<ProjectionJobRecord | null>;
}

export function createMemoryJobStore(): ProjectionJobStore & {
  rows: Map<string, ProjectionJobRecord>;
} {
  const rows = new Map<string, ProjectionJobRecord>();
  return {
    rows,
    async findByIdempotency(input) {
      for (const row of rows.values()) {
        if (
          row.serviceSource === input.serviceSource &&
          row.caseId === input.caseId &&
          row.idempotencyKey === input.idempotencyKey
        ) {
          return row;
        }
      }
      return null;
    },
    async insert(input) {
      const now = new Date().toISOString();
      const row: ProjectionJobRecord = {
        id: randomUUID(),
        sourceChannel: input.sourceChannel,
        serviceSource: input.serviceSource,
        tenantId: input.tenantId,
        clinicId: input.clinicId,
        caseId: input.caseId,
        externalCaseId: input.externalCaseId,
        externalProjectionId: input.externalProjectionId,
        patientId: input.patientId,
        procedureId: input.procedureId,
        idempotencyKey: input.idempotencyKey,
        inputChecksum: input.inputChecksum,
        schemaVersion: input.schemaVersion,
        mode: input.mode,
        modelVersion: input.modelVersion,
        status: "received",
        requestPayloadChecksum: input.requestPayloadChecksum,
        providerName: input.providerName,
        providerRequestId: null,
        providerResponseId: null,
        outputStorageRef: null,
        outputChecksum: null,
        errorCode: null,
        errorMessageSafe: null,
        attemptCount: 0,
        clinicianReviewState: "not_applicable",
        patientVisibilityEligibility: "ineligible",
        supersededByJobId: null,
        staleReason: null,
        immutableSnapshot: input.immutableSnapshot,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      rows.set(row.id, row);
      return row;
    },
    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`job_not_found:${id}`);
      const next: ProjectionJobRecord = {
        ...existing,
        status: patch.status ?? existing.status,
        providerRequestId:
          patch.providerRequestId !== undefined
            ? patch.providerRequestId
            : existing.providerRequestId,
        providerResponseId:
          patch.providerResponseId !== undefined
            ? patch.providerResponseId
            : existing.providerResponseId,
        outputStorageRef:
          patch.outputStorageRef !== undefined
            ? patch.outputStorageRef
            : existing.outputStorageRef,
        outputChecksum:
          patch.outputChecksum !== undefined ? patch.outputChecksum : existing.outputChecksum,
        errorCode: patch.errorCode !== undefined ? patch.errorCode : existing.errorCode,
        errorMessageSafe:
          patch.errorMessageSafe !== undefined
            ? patch.errorMessageSafe
            : existing.errorMessageSafe,
        attemptCount: patch.attemptCount ?? existing.attemptCount,
        clinicianReviewState: patch.clinicianReviewState ?? existing.clinicianReviewState,
        patientVisibilityEligibility:
          patch.patientVisibilityEligibility ?? existing.patientVisibilityEligibility,
        completedAt: patch.completedAt !== undefined ? patch.completedAt : existing.completedAt,
        externalProjectionId:
          patch.externalProjectionId !== undefined
            ? patch.externalProjectionId
            : existing.externalProjectionId,
        updatedAt: new Date().toISOString(),
      };
      rows.set(id, next);
      return next;
    },
    async getById(id) {
      return rows.get(id) ?? null;
    },
  };
}

export function createSupabaseJobStore(): ProjectionJobStore {
  return {
    async findByIdempotency(input) {
      const db = supabaseAdmin();
      const { data, error } = await db
        .from("imaging_os_pre_surgery_projection_jobs")
        .select("*")
        .eq("service_source", input.serviceSource)
        .eq("case_id", input.caseId)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as Record<string, unknown>) : null;
    },
    async insert(input) {
      const db = supabaseAdmin();
      const { data, error } = await db
        .from("imaging_os_pre_surgery_projection_jobs")
        .insert({
          source_channel: input.sourceChannel,
          service_source: input.serviceSource,
          tenant_id: input.tenantId,
          clinic_id: input.clinicId,
          case_id: input.caseId,
          external_case_id: input.externalCaseId,
          external_projection_id: input.externalProjectionId,
          patient_id: input.patientId,
          procedure_id: input.procedureId,
          idempotency_key: input.idempotencyKey,
          input_checksum: input.inputChecksum,
          schema_version: input.schemaVersion,
          mode: input.mode,
          model_version: input.modelVersion,
          status: "received",
          request_payload_checksum: input.requestPayloadChecksum,
          provider_name: input.providerName,
          immutable_snapshot: input.immutableSnapshot,
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },
    async update(id, patch) {
      const db = supabaseAdmin();
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.providerRequestId !== undefined) payload.provider_request_id = patch.providerRequestId;
      if (patch.providerResponseId !== undefined)
        payload.provider_response_id = patch.providerResponseId;
      if (patch.outputStorageRef !== undefined) payload.output_storage_ref = patch.outputStorageRef;
      if (patch.outputChecksum !== undefined) payload.output_checksum = patch.outputChecksum;
      if (patch.errorCode !== undefined) payload.error_code = patch.errorCode;
      if (patch.errorMessageSafe !== undefined) payload.error_message_safe = patch.errorMessageSafe;
      if (patch.attemptCount !== undefined) payload.attempt_count = patch.attemptCount;
      if (patch.clinicianReviewState !== undefined)
        payload.clinician_review_state = patch.clinicianReviewState;
      if (patch.patientVisibilityEligibility !== undefined)
        payload.patient_visibility_eligibility = patch.patientVisibilityEligibility;
      if (patch.completedAt !== undefined) payload.completed_at = patch.completedAt;
      if (patch.externalProjectionId !== undefined)
        payload.external_projection_id = patch.externalProjectionId;

      const { data, error } = await db
        .from("imaging_os_pre_surgery_projection_jobs")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },
    async getById(id) {
      const db = supabaseAdmin();
      const { data, error } = await db
        .from("imaging_os_pre_surgery_projection_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as Record<string, unknown>) : null;
    },
  };
}

export const TERMINAL_JOB_STATUSES: ReadonlySet<ProjectionJobStatus> = new Set([
  "completed",
  "failed",
  "timed_out",
  "cancelled",
]);
