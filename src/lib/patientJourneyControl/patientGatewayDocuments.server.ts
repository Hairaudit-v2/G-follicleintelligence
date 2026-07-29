/**
 * FI-PATIENT-APP-P1 — patient gateway document packets / sections.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { patientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayGateCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayTypes";

import {
  formatMissingDocumentSections,
  isPatientDocumentSectionKey,
  PATIENT_DOCUMENT_SECTION_LABELS,
} from "./patientJourneyControlContracts";
import { handleJourneyControlEvent } from "./patientJourneyControlEvents.server";

export type PatientDocumentSection = {
  key: string;
  label: string;
  status: string;
  isRequired: boolean;
  formData: Record<string, unknown>;
  rejectedReason: string | null;
  completedAt: string | null;
};

export type PatientDocumentPacket = {
  id: string;
  packetKey: string;
  version: number;
  status: string;
  sections: PatientDocumentSection[];
  missingRequiredSections: string[];
  incompletenessMessage: string;
  signedAt: string | null;
  signedByName: string | null;
  canSign: boolean;
};

export type PatientGatewayDocumentsOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
  writeAudit?: boolean;
};

type PacketRow = Record<string, unknown>;
type SectionRow = Record<string, unknown>;

function mapSection(row: SectionRow): PatientDocumentSection {
  const key = String(row.section_key ?? "");
  const formData =
    row.form_data && typeof row.form_data === "object" && !Array.isArray(row.form_data)
      ? (row.form_data as Record<string, unknown>)
      : {};
  return {
    key,
    label:
      row.label != null
        ? String(row.label)
        : isPatientDocumentSectionKey(key)
          ? PATIENT_DOCUMENT_SECTION_LABELS[key]
          : key,
    status: String(row.status ?? "not_started"),
    isRequired: Boolean(row.is_required !== false),
    formData,
    rejectedReason: row.rejected_reason != null ? String(row.rejected_reason) : null,
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
  };
}

function buildPacket(packet: PacketRow, sections: SectionRow[]): PatientDocumentPacket {
  const mapped = sections
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map(mapSection);
  const missingRequiredSections = mapped
    .filter((s) => s.isRequired && s.status !== "completed")
    .map((s) => s.key);
  const status = String(packet.status ?? "draft");
  const signedAt = packet.signed_at != null ? String(packet.signed_at) : null;
  return {
    id: String(packet.id),
    packetKey: String(packet.packet_key ?? ""),
    version: Number(packet.version) || 1,
    status,
    sections: mapped,
    missingRequiredSections,
    incompletenessMessage: formatMissingDocumentSections(missingRequiredSections),
    signedAt,
    signedByName: packet.signed_by_name != null ? String(packet.signed_by_name) : null,
    canSign: missingRequiredSections.length === 0 && !signedAt && status !== "completed",
  };
}

async function loadOwnedPacket(
  ctx: PatientGatewayContext,
  packetId: string,
  supabase: SupabaseClient
): Promise<{ packet: PacketRow; sections: SectionRow[] } | PatientGatewayDeny> {
  let pid: string;
  try {
    pid = assertNonEmptyUuid(packetId, "packetId");
  } catch {
    return patientGatewayDeny("not_found", 404, "Document packet not found.");
  }
  const { data: packet, error } = await supabase
    .from("fi_patient_document_packets")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("id", pid)
    .maybeSingle();
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to load documents.");
  if (!packet) return patientGatewayDeny("not_found", 404, "Document packet not found.");

  const { data: sections, error: se } = await supabase
    .from("fi_patient_document_sections")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("packet_id", pid)
    .order("sort_order", { ascending: true });
  if (se) return patientGatewayDeny("misconfigured", 500, "Unable to load document sections.");
  return { packet: packet as PacketRow, sections: (sections ?? []) as SectionRow[] };
}

export async function listPatientDocumentsForGateway(
  ctx: PatientGatewayContext,
  options?: PatientGatewayDocumentsOptions
): Promise<{ ok: true; packets: PatientDocumentPacket[] } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_document_packets")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to load documents.");

  const packets: PatientDocumentPacket[] = [];
  for (const raw of data ?? []) {
    const packet = raw as PacketRow;
    const { data: sections } = await supabase
      .from("fi_patient_document_sections")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("packet_id", String(packet.id))
      .order("sort_order", { ascending: true });
    packets.push(buildPacket(packet, (sections ?? []) as SectionRow[]));
  }
  return { ok: true, packets };
}

export async function getPatientDocumentForGateway(
  ctx: PatientGatewayContext,
  packetId: string,
  options?: PatientGatewayDocumentsOptions
): Promise<{ ok: true; packet: PatientDocumentPacket } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const loaded = await loadOwnedPacket(ctx, packetId, supabase);
  if ("ok" in loaded && loaded.ok === false) return loaded;
  const { packet, sections } = loaded as { packet: PacketRow; sections: SectionRow[] };
  return { ok: true, packet: buildPacket(packet, sections) };
}

export async function savePatientDocumentSectionForGateway(
  ctx: PatientGatewayContext,
  packetId: string,
  sectionKey: string,
  formData: Record<string, unknown>,
  options?: PatientGatewayDocumentsOptions
): Promise<{ ok: true; packet: PatientDocumentPacket } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  if (!isPatientDocumentSectionKey(sectionKey)) {
    return patientGatewayDeny("invalid_category", 400, "Unknown document section.");
  }
  const loaded = await loadOwnedPacket(ctx, packetId, supabase);
  if ("ok" in loaded && loaded.ok === false) return loaded;
  const { packet } = loaded as { packet: PacketRow; sections: SectionRow[] };

  const { error } = await supabase
    .from("fi_patient_document_sections")
    .update({
      form_data: formData,
      status: "in_progress",
      rejected_reason: null,
      updated_at: now,
    })
    .eq("tenant_id", ctx.tenantId)
    .eq("packet_id", String(packet.id))
    .eq("section_key", sectionKey);
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to save section.");

  // Mark completed when formData has any keys (client may send complete:true).
  if (formData.complete === true || formData.completed === true) {
    await supabase
      .from("fi_patient_document_sections")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .eq("tenant_id", ctx.tenantId)
      .eq("packet_id", String(packet.id))
      .eq("section_key", sectionKey);
  }

  await supabase
    .from("fi_patient_document_packets")
    .update({ status: "in_progress", updated_at: now })
    .eq("id", String(packet.id))
    .eq("tenant_id", ctx.tenantId);

  return getPatientDocumentForGateway(ctx, String(packet.id), { ...options, supabase });
}

export async function signPatientDocumentPacketForGateway(
  ctx: PatientGatewayContext,
  packetId: string,
  signedByName: string,
  options?: PatientGatewayDocumentsOptions
): Promise<{ ok: true; packet: PatientDocumentPacket } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const writeAudit = options?.writeAudit !== false;
  const now = options?.nowIso ?? new Date().toISOString();
  const name = signedByName.trim();
  if (!name) return patientGatewayDeny("invalid_category", 400, "Signature name is required.");

  const current = await getPatientDocumentForGateway(ctx, packetId, { ...options, supabase });
  if (!current.ok) return current;
  if (!current.packet.canSign) {
    return patientGatewayDeny(
      "ownership_denied",
      403,
      current.packet.incompletenessMessage || "Packet cannot be signed yet."
    );
  }

  const { error } = await supabase
    .from("fi_patient_document_packets")
    .update({
      status: "signed",
      signed_at: now,
      signed_by_name: name,
      updated_at: now,
    })
    .eq("id", current.packet.id)
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId);
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to sign packet.");

  await handleJourneyControlEvent(
    {
      event: "document_packet_completed",
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      resourceType: "document_packet",
      resourceId: current.packet.id,
      authUserId: ctx.authUserId,
    },
    { supabase, nowIso: now }
  );

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "document_signed",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "document",
      resourceId: current.packet.id,
    });
  }

  return getPatientDocumentForGateway(ctx, current.packet.id, { ...options, supabase });
}

/** Staff: reject packet / section and notify patient. */
export async function rejectPatientDocumentPacket(
  args: {
    tenantId: string;
    patientId: string;
    packetId: string;
    reason: string;
    sectionKey?: string | null;
    authUserId?: string | null;
  },
  options?: PatientGatewayDocumentsOptions
): Promise<{ ok: true }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const packetId = assertNonEmptyUuid(args.packetId, "packetId");
  const reason = args.reason.trim() || "Please review and update your documents.";

  if (args.sectionKey) {
    await supabase
      .from("fi_patient_document_sections")
      .update({
        status: "rejected",
        rejected_reason: reason,
        completed_at: null,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("packet_id", packetId)
      .eq("section_key", args.sectionKey);
  }

  await supabase
    .from("fi_patient_document_packets")
    .update({
      status: "rejected_needs_correction",
      signed_at: null,
      signed_by_name: null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", packetId);

  await handleJourneyControlEvent(
    {
      event: "document_rejected",
      tenantId: tid,
      patientId: pid,
      resourceType: "document_packet",
      resourceId: packetId,
      authUserId: args.authUserId ?? null,
      detail: { reason, sectionKey: args.sectionKey ?? null },
    },
    { supabase, nowIso: now }
  );
  return { ok: true };
}