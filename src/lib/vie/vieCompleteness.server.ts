import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSlotImageIds,
  isSessionMarkedComplete,
  parseProgressMeta,
  protocolRequiredCompletionPercent,
  slotIsSatisfied,
  type ProtocolSlotDef,
} from "@/src/lib/imagingOs/imagingOsProtocol";
import { loadResolvedProtocolSlots } from "@/src/lib/imaging-os/protocolCatalogResolver.server";
import { enrichPatientImagingCompleteness } from "./vieCompleteness";
import { getVieProtocol, isVieProtocolSlug } from "./vieProtocolCatalog";
import type {
  ViePatientImagingCompleteness,
  VieProtocolCompleteness,
  VieProtocolSlotStatus,
  VieProtocolSlug,
  VieSlotCompletionStatus,
  VieSlotTier,
} from "./vieProtocolTypes";
import { VIE_ENGINE_VERSION } from "./vieProtocolTypes";

function slotTierFor(slug: string, templateSlug: string): VieSlotTier {
  const catalog = getVieProtocol(templateSlug);
  const def = catalog?.slots.find((s) => s.slug === slug);
  if (def?.slot_tier) return def.slot_tier;
  return def?.required === false ? "optional" : "primary";
}

function slotStatus(
  slot: ProtocolSlotDef,
  progress: Record<string, unknown>
): VieSlotCompletionStatus {
  const ids = getSlotImageIds(progress, slot.slug);
  if (ids.length > 0) return "captured";
  if (slot.required === false) {
    const sk = parseProgressMeta(progress).skips?.[slot.slug];
    if (sk?.reason?.trim()) return "skipped";
  }
  return "missing";
}

function buildProtocolCompleteness(
  templateSlug: VieProtocolSlug,
  templateName: string,
  slots: ProtocolSlotDef[],
  progress: Record<string, unknown>
): VieProtocolCompleteness {
  const required = slots.filter((s) => s.required !== false);
  const optional = slots.filter((s) => s.required === false);
  const requiredComplete = required.filter((s) => slotIsSatisfied(s, progress)).length;
  const optionalComplete = optional.filter((s) => slotIsSatisfied(s, progress)).length;
  const percent = protocolRequiredCompletionPercent(slots, progress);

  const slotStatuses: VieProtocolSlotStatus[] = slots.map((s) => ({
    slug: s.slug,
    label: s.label,
    required: s.required !== false,
    slot_tier: slotTierFor(s.slug, templateSlug),
    status: slotStatus(s, progress),
    patient_image_id: getSlotImageIds(progress, s.slug)[0] ?? null,
  }));

  return {
    protocol_slug: templateSlug,
    protocol_name: templateName,
    required_total: required.length,
    required_complete: requiredComplete,
    optional_total: optional.length,
    optional_complete: optionalComplete,
    percent,
    complete: percent >= 100,
    display: `${requiredComplete}/${required.length} ${templateName.toLowerCase()} images complete`,
    slots: slotStatuses,
  };
}

type SessionRow = {
  id: string;
  template_slug: VieProtocolSlug;
  progress: Record<string, unknown>;
};

async function loadPatientVieSessions(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<SessionRow[]> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select("id, template_slug, progress")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows: SessionRow[] = [];
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const slug = String(r.template_slug ?? "").trim();
    if (!isVieProtocolSlug(slug)) continue;
    const progress =
      r.progress && typeof r.progress === "object" && !Array.isArray(r.progress)
        ? (r.progress as Record<string, unknown>)
        : {};
    rows.push({ id: String(r.id), template_slug: slug, progress });
  }
  return rows;
}

async function loadTemplateSlots(
  tenantId: string,
  templateSlug: string,
  client: SupabaseClient
): Promise<{ name: string; slots: ProtocolSlotDef[] }> {
  const resolved = await loadResolvedProtocolSlots(tenantId, templateSlug, client);
  return { name: resolved.name, slots: resolved.slots };
}

/**
 * Compute VIE imaging completeness for a patient profile or Patient Twin section.
 */
export async function loadViePatientImagingCompleteness(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<ViePatientImagingCompleteness> {
  const supabase = client ?? supabaseAdmin();
  const sessions = await loadPatientVieSessions(tenantId, patientId, supabase);

  const protocols: VieProtocolCompleteness[] = [];
  for (const session of sessions) {
    const tpl = await loadTemplateSlots(tenantId, session.template_slug, supabase);
    if (!tpl.slots.length) continue;
    protocols.push(
      buildProtocolCompleteness(session.template_slug, tpl.name, tpl.slots, session.progress)
    );
  }

  const activeSession =
    sessions.find(
      (s) => s.template_slug === "baseline_consultation" && !isSessionMarkedComplete(s.progress)
    ) ??
    sessions.find((s) => s.template_slug === "baseline_consultation") ??
    sessions.find((s) => !isSessionMarkedComplete(s.progress)) ??
    sessions[0] ??
    null;

  let headline: VieProtocolCompleteness;
  if (activeSession) {
    const tpl = await loadTemplateSlots(tenantId, activeSession.template_slug, supabase);
    headline = buildProtocolCompleteness(
      activeSession.template_slug,
      tpl.name,
      tpl.slots,
      activeSession.progress
    );
  } else {
    const baseline = getVieProtocol("baseline_consultation")!;
    const emptyProgress: Record<string, unknown> = {};
    headline = buildProtocolCompleteness(
      "baseline_consultation",
      baseline.name,
      baseline.slots.map((s) => ({
        slug: s.slug,
        label: s.label,
        required: s.required,
        suggested_region: s.suggested_region,
        instruction: s.instruction,
      })),
      emptyProgress
    );
  }

  const sessionSnapshots = sessions.map((s) => ({
    template_slug: s.template_slug,
    progress: s.progress,
  }));

  return enrichPatientImagingCompleteness(
    {
      engine_version: VIE_ENGINE_VERSION,
      headline,
      protocols,
      latest_capture_quality: null,
      active_session_id: activeSession?.id ?? null,
      active_protocol_slug: activeSession?.template_slug ?? null,
    },
    sessionSnapshots
  );
}
