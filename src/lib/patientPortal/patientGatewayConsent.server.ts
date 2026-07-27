/**
 * Patient gateway photography consent — status + in-app attestation.
 * Identity always comes from gateway context (never client tenant/patient claims).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishPatientEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import {
  loadTrialConsentGateStatus,
  type TrialConsentGateStatus,
} from "@/src/lib/patients/patientConsentGate.server";
import {
  buildPatientDocumentStoragePath,
  PATIENT_DOCUMENTS_BUCKET_DEFAULT,
} from "@/src/lib/patients/patientDocumentPolicy";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import {
  buildPatientGatewayConsentStatus,
  type PatientGatewayConsentStatus,
} from "./patientGatewayConsentCore";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

export const PATIENT_GATEWAY_CONSENT_SOURCE = "patient_gateway_consent_v1";

const ATTESTATION_FILENAME = "patient-app-consent.txt";

function buildAttestationBody(ctx: PatientGatewayContext, attestedAt: string): string {
  return [
    "Follicle Intelligence — Patient photography consent attestation",
    "",
    `Attested at: ${attestedAt}`,
    `Patient id: ${ctx.patientId}`,
    `Tenant id: ${ctx.tenantId}`,
    `Auth user id: ${ctx.authUserId}`,
    "",
    "The patient confirmed in the Follicle Intelligence patient app that they",
    "consent to clinical progress photography being captured and uploaded for",
    "their treating clinic to review as part of their care.",
  ].join("\n");
}

export type PatientGatewayConsentOptions = {
  writeAudit?: boolean;
  supabase?: SupabaseClient;
  loadGateStatus?: (
    tenantId: string,
    patientId: string
  ) => Promise<TrialConsentGateStatus>;
  recordAttestation?: (ctx: PatientGatewayContext) => Promise<{ documentId: string }>;
};

function auditEnabled(options?: PatientGatewayConsentOptions): boolean {
  return options?.writeAudit !== false;
}

async function defaultRecordAttestation(
  ctx: PatientGatewayContext,
  client: SupabaseClient
): Promise<{ documentId: string }> {
  const now = new Date().toISOString();
  const documentId = randomUUID();
  const body = buildAttestationBody(ctx, now);
  const bytes = Buffer.from(body, "utf8");
  const storagePath = buildPatientDocumentStoragePath({
    tenantId: ctx.tenantId,
    patientId: ctx.patientId,
    documentId,
    documentType: "consent",
    safeFilename: ATTESTATION_FILENAME,
  });
  const bucket = PATIENT_DOCUMENTS_BUCKET_DEFAULT;
  const contentType = "text/plain";

  const { error: uploadErr } = await client.storage.from(bucket).upload(storagePath, bytes, {
    contentType,
    upsert: false,
  });
  if (uploadErr) {
    throw new Error(`Consent attestation storage failed: ${uploadErr.message}`);
  }

  const { error: insErr } = await client.from("fi_patient_documents").insert({
    id: documentId,
    tenant_id: ctx.tenantId,
    patient_id: ctx.patientId,
    person_id: ctx.personId,
    document_type: "consent",
    storage_bucket: bucket,
    storage_path: storagePath,
    original_filename: ATTESTATION_FILENAME,
    content_type: contentType,
    file_size_bytes: bytes.byteLength,
    notes: "Patient attested in mobile app",
    metadata: {
      source: PATIENT_GATEWAY_CONSENT_SOURCE,
      method: "in_app_acknowledgment",
      attested_at: now,
    },
    uploaded_by_user_id: null,
    created_at: now,
    updated_at: now,
  });

  if (insErr) {
    await client.storage
      .from(bucket)
      .remove([storagePath])
      .catch(() => undefined);
    throw new Error(insErr.message);
  }

  void publishPatientEvent({
    tenantId: ctx.tenantId,
    eventType: "patient_document_uploaded",
    entityId: documentId,
    entityType: "document",
    eventMetadata: {
      patient_id: ctx.patientId,
      document_type: "consent",
      source: PATIENT_GATEWAY_CONSENT_SOURCE,
    },
  });

  return { documentId };
}

export async function getPatientGatewayConsent(
  ctx: PatientGatewayContext,
  options?: PatientGatewayConsentOptions
): Promise<PatientGatewayConsentStatus> {
  const loadGate =
    options?.loadGateStatus ??
    ((tenantId: string, patientId: string) =>
      loadTrialConsentGateStatus(tenantId, patientId, options?.supabase));

  const gate = await loadGate(ctx.tenantId, ctx.patientId);
  const status = buildPatientGatewayConsentStatus(gate);

  if (auditEnabled(options)) {
    writePatientGatewayAudit({
      action: "consent_read_success",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "document",
    });
  }

  return status;
}

export async function recordPatientGatewayConsent(
  ctx: PatientGatewayContext,
  options?: PatientGatewayConsentOptions
): Promise<PatientGatewayConsentStatus | PatientGatewayDeny> {
  const loadGate =
    options?.loadGateStatus ??
    ((tenantId: string, patientId: string) =>
      loadTrialConsentGateStatus(
        tenantId,
        patientId,
        options?.supabase ?? supabaseAdmin()
      ));

  const before = await loadGate(ctx.tenantId, ctx.patientId);
  const beforeStatus = buildPatientGatewayConsentStatus(before);

  // Idempotent: not required, or already satisfied.
  if (!beforeStatus.required || beforeStatus.satisfied) {
    if (auditEnabled(options)) {
      writePatientGatewayAudit({
        action: "consent_recorded",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "document",
      });
    }
    return beforeStatus;
  }

  try {
    const record =
      options?.recordAttestation ??
      ((c: PatientGatewayContext) =>
        defaultRecordAttestation(c, options?.supabase ?? supabaseAdmin()));
    const { documentId } = await record(ctx);

    if (auditEnabled(options)) {
      writePatientGatewayAudit({
        action: "consent_recorded",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "document",
        resourceId: documentId,
      });
    }

    return buildPatientGatewayConsentStatus({ required: true, satisfied: true });
  } catch {
    if (auditEnabled(options)) {
      writePatientGatewayAudit({
        action: "consent_record_denied",
        outcome: "deny",
        code: "misconfigured",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "document",
      });
    }
    return patientGatewayDeny(
      "misconfigured",
      500,
      "Could not record photography consent. Please try again."
    );
  }
}
