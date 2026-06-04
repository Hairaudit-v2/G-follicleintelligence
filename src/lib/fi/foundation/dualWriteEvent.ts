/**
 * Stage 1F — dual-write FI event ingest into foundation tables (fi_persons, fi_patients, fi_cases FKs,
 * fi_timeline_events, fi_media_assets). Never throws: failures are logged; primary fi_events ingest must succeed.
 * Server-only — do not import from client components.
 */

import { parseFiEventPayload } from "@/lib/fi/events/schema";
import type { FiEventEnvelope } from "@/src/types/fi-events";
import { createMediaAsset } from "./createMediaAsset";
import { createTimelineEvent } from "./createTimelineEvent";
import {
  getFoundationCaseTypeForEvent,
  getFoundationTimelineSpec,
  getHairAuditImagesTimelineSpec,
  mapHairAuditImageToAssetType,
  mapHliDocumentKindToMediaAssetType,
} from "./eventMapping";
import { resolveOrCreateCaseFoundation } from "./resolveCaseFoundation";
import { resolveOrCreateClinic } from "./resolveClinic";
import { resolveOrCreateOrganisation } from "./resolveOrganisation";
import { resolveOrCreatePatient } from "./resolvePatient";
import { resolveOrCreatePerson } from "./resolvePerson";
import type { FoundationSupabase } from "./types";

const LOG_PREFIX = "[fi-foundation-dual-write]";

export type DualWriteFoundationResolution = {
  fiCaseId?: string | null;
  globalPatientId?: string | null;
  globalCaseId?: string | null;
};

export type DualWriteFoundationFromFiEventParams = {
  tenantId: string;
  fiEventId: string;
  envelope: FiEventEnvelope;
  resolution: DualWriteFoundationResolution;
  supabase?: FoundationSupabase;
};

export type DualWriteFoundationFromFiEventResult = {
  ok: boolean;
  skipped_reason?: string;
  error?: string;
  timeline_created?: boolean;
  media_assets_upserted?: number;
};

function logDualWriteFailure(context: Record<string, unknown>, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(LOG_PREFIX, { ...context, message });
}

function readNestedString(payload: Record<string, unknown>, path: string[]): string | undefined {
  let cur: unknown = payload;
  for (const key of path) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : undefined;
}

function extractOrganisationHints(
  payload: Record<string, unknown>
): { source_organisation_id?: string; name?: string } | null {
  const soid = typeof payload.source_organisation_id === "string" ? payload.source_organisation_id.trim() : "";
  const oid = typeof payload.organisation_id === "string" ? payload.organisation_id.trim() : "";
  const orgName = readNestedString(payload, ["organisation", "name"]);
  const orgId = readNestedString(payload, ["organisation", "id"]);
  const sourceId = soid || oid || orgId;
  const name =
    orgName ||
    (typeof payload.organisation_name === "string" && payload.organisation_name.trim()
      ? payload.organisation_name.trim()
      : undefined);
  if (!sourceId && !name) return null;
  return {
    ...(sourceId ? { source_organisation_id: sourceId } : {}),
    ...(name ? { name } : {}),
  };
}

function extractClinicDisplayName(payload: Record<string, unknown>): string | undefined {
  return (
    readNestedString(payload, ["clinic", "name"]) ||
    readNestedString(payload, ["clinic", "display_name"]) ||
    (typeof payload.clinic_name === "string" && payload.clinic_name.trim() ? payload.clinic_name.trim() : undefined)
  );
}

function derivePersonDemographics(envelope: FiEventEnvelope): {
  display_name?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
} {
  const pr = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!pr.ok) return {};
  if ("intake" in pr.data && pr.data.intake) {
    const i = pr.data.intake;
    return {
      display_name: i.full_name,
      email: i.email,
      date_of_birth: i.dob,
      sex: i.sex,
    };
  }
  if ("case" in pr.data && pr.data.case) {
    const c = pr.data.case;
    return {
      display_name: c.patient_name ?? null,
      email: c.email ?? null,
      date_of_birth: c.dob ?? null,
      sex: c.sex ?? null,
    };
  }
  return {};
}

/**
 * After a row exists in fi_events and fi_event_links (global patient/case linking), populate foundation tables.
 * Idempotent via underlying Stage 1E helpers. Never throws.
 */
export async function dualWriteFoundationFromFiEvent(
  params: DualWriteFoundationFromFiEventParams
): Promise<DualWriteFoundationFromFiEventResult> {
  const { tenantId, fiEventId, envelope, resolution, supabase } = params;
  const client = supabase;

  const fiCaseId = resolution.fiCaseId?.trim() || null;
  if (!fiCaseId) {
    return { ok: false, skipped_reason: "missing fi_case_id" };
  }

  const sourceSystem = envelope.source_system;
  const identifiers = envelope.identifiers;
  const sourceCaseId = identifiers?.source_case_id?.trim() || null;
  const sourcePatientId = identifiers?.source_patient_id?.trim() || null;
  const payload = envelope.payload as Record<string, unknown>;

  try {
    let organisationId: string | null = null;
    const orgHints = extractOrganisationHints(payload);
    if (orgHints) {
      const orgRes = await resolveOrCreateOrganisation(
        {
          tenant_id: tenantId,
          source_system: sourceSystem,
          source_organisation_id: orgHints.source_organisation_id ?? null,
          name: orgHints.name ?? null,
          type: "clinical_network",
          metadata: { dual_write_event_type: envelope.event_type },
        },
        client
      );
      organisationId = orgRes.organisation.id;
    }

    let clinicId: string | null = null;
    const sourceClinicId = identifiers?.source_clinic_id?.trim() || null;
    const clinicDisplayName = extractClinicDisplayName(payload);
    if (sourceClinicId || clinicDisplayName) {
      const clinicRes = await resolveOrCreateClinic(
        {
          tenant_id: tenantId,
          organisation_id: organisationId,
          source_system: sourceSystem,
          source_clinic_id: sourceClinicId,
          name: clinicDisplayName ?? undefined,
          metadata: { dual_write_event_type: envelope.event_type },
        },
        client
      );
      clinicId = clinicRes.clinic.id;
    }

    const demo = derivePersonDemographics(envelope);
    const personRes = await resolveOrCreatePerson(
      {
        tenant_id: tenantId,
        source_system: sourceSystem,
        source_patient_id: sourcePatientId,
        display_name: demo.display_name ?? undefined,
        email: demo.email ?? undefined,
        date_of_birth: demo.date_of_birth ?? undefined,
        sex: demo.sex ?? undefined,
        metadata: {
          dual_write_event_type: envelope.event_type,
          source_event_id: envelope.source_event_id,
        },
      },
      client
    );

    const patientRes = await resolveOrCreatePatient(
      {
        tenant_id: tenantId,
        person_id: personRes.person.id,
        source_system: sourceSystem,
        source_patient_id: sourcePatientId,
        global_patient_id: resolution.globalPatientId?.trim() || null,
        primary_clinic_id: clinicId,
        metadata: {
          dual_write_event_type: envelope.event_type,
        },
      },
      client
    );

    const caseType = getFoundationCaseTypeForEvent(envelope.event_type);
    await resolveOrCreateCaseFoundation(
      {
        tenant_id: tenantId,
        existing_case_id: fiCaseId,
        foundation_patient_id: patientRes.patient.id,
        clinic_id: clinicId,
        organisation_id: organisationId,
        source_system: sourceSystem,
        source_case_id: sourceCaseId,
        case_type: caseType,
        metadata: {
          foundation_dual_write: true,
          fi_event_id: fiEventId,
          global_case_id: resolution.globalCaseId ?? undefined,
        },
      },
      client
    );

    let timelineSpec = getFoundationTimelineSpec(envelope.event_type);
    if (envelope.event_type === "hairaudit.images.uploaded") {
      const imgPr = parseFiEventPayload(envelope.event_type, envelope.payload);
      if (imgPr.ok && "images" in imgPr.data) {
        timelineSpec = getHairAuditImagesTimelineSpec(imgPr.data.images.map((im) => im.type));
      }
    }

    let timeline_created = false;
    if (timelineSpec) {
      const tl = await createTimelineEvent(
        {
          tenant_id: tenantId,
          case_id: fiCaseId,
          foundation_patient_id: patientRes.patient.id,
          organisation_id: organisationId,
          fi_event_id: fiEventId,
          event_type: timelineSpec.event_kind,
          title: timelineSpec.title,
          occurred_at: envelope.occurred_at ?? undefined,
          metadata: {
            global_case_id: resolution.globalCaseId ?? undefined,
            source_system: sourceSystem,
            event_type: envelope.event_type,
          },
        },
        client
      );
      timeline_created = tl.created;
    }

    let media_assets_upserted = 0;
    if (envelope.event_type === "hli.document.uploaded") {
      const docPr = parseFiEventPayload(envelope.event_type, envelope.payload);
      if (docPr.ok && "document" in docPr.data) {
        const doc = docPr.data.document;
        const storagePath = doc.storage_path?.trim();
        if (storagePath) {
          const assetType = mapHliDocumentKindToMediaAssetType(doc.kind);
          const ma = await createMediaAsset(
            {
              tenant_id: tenantId,
              case_id: fiCaseId,
              foundation_patient_id: patientRes.patient.id,
              person_id: personRes.person.id,
              clinic_id: clinicId,
              organisation_id: organisationId,
              source_system: sourceSystem,
              source_asset_id: `${fiEventId}:${storagePath}`,
              asset_type: assetType,
              storage_path: storagePath,
              file_name: doc.filename,
              mime_type: doc.mime_type ?? null,
              size_bytes: doc.size_bytes ?? null,
              metadata: { document_kind: doc.kind, fi_event_id: fiEventId },
            },
            client
          );
          if (ma.created) media_assets_upserted += 1;
        }
      }
    }

    if (envelope.event_type === "hairaudit.images.uploaded") {
      const imgPr = parseFiEventPayload(envelope.event_type, envelope.payload);
      if (imgPr.ok && "images" in imgPr.data) {
        for (const image of imgPr.data.images) {
          const storagePath = image.storage_path?.trim();
          if (!storagePath) continue;
          const assetType = mapHairAuditImageToAssetType(image.type);
          const ma = await createMediaAsset(
            {
              tenant_id: tenantId,
              case_id: fiCaseId,
              foundation_patient_id: patientRes.patient.id,
              person_id: personRes.person.id,
              clinic_id: clinicId,
              organisation_id: organisationId,
              source_system: sourceSystem,
              source_asset_id: `${fiEventId}:${storagePath}`,
              asset_type: assetType,
              storage_path: storagePath,
              file_name: image.filename,
              mime_type: image.mime_type ?? null,
              size_bytes: image.size_bytes ?? null,
              metadata: { hairaudit_image_type: image.type, fi_event_id: fiEventId },
            },
            client
          );
          if (ma.created) media_assets_upserted += 1;
        }
      }
    }

    return { ok: true, timeline_created, media_assets_upserted };
  } catch (error: unknown) {
    logDualWriteFailure(
      {
        tenantId,
        fiEventId,
        event_type: envelope.event_type,
        source_system: sourceSystem,
        fiCaseId,
      },
      error
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown foundation dual-write error.",
    };
  }
}
