import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadPatientImagesProfileBundle } from "@/src/lib/patientImages/patientImagesServer";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import {
  protocolRequiredCompletionPercent,
  type ProtocolSlotDef,
} from "./imagingOsProtocol";
import { loadResolvedProtocol } from "@/src/lib/imaging-os/protocolCatalogResolver.server";
import type { ProtocolCatalogSource } from "@/src/lib/imaging-os/protocolCatalogResolverCore";
import type { VieComparisonPairRow } from "@/src/lib/vie/vieComparisonTypes";

export const GUIDED_CAPTURE_TEMPLATE_SLUGS = [
  "hair_loss_consultation",
  "baseline_consultation",
  "hair_transplant_planning",
  "surgery_day",
  "follow_up_review",
  "trichoscopy_review",
] as const;

export type ImagingProtocolTemplateRow = {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  slots: ProtocolSlotDef[];
  protocol_catalog_source?: ProtocolCatalogSource;
  protocol_catalog_version?: string;
};

export type ImagingProtocolSessionRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  case_id: string | null;
  consultation_id: string | null;
  template_slug: string;
  progress: Record<string, unknown>;
  completion_percent: number;
  created_at: string;
  updated_at: string;
};

export type ImagingScalpMapRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  consultation_id: string | null;
  case_id: string | null;
  title: string;
  state_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ImagingAnnotationRow = {
  patient_image_id: string;
  schema_version: string;
  payload: Record<string, unknown>;
  updated_at: string;
};

export type ImagingOsPatientPayload = {
  bundle: PatientImagesProfileBundle;
  protocolTemplates: ImagingProtocolTemplateRow[];
  protocolSessions: ImagingProtocolSessionRow[];
  scalpMaps: ImagingScalpMapRow[];
  annotationsByImageId: Record<string, ImagingAnnotationRow>;
  comparisonPairs: VieComparisonPairRow[];
};

async function resolveProtocolTemplateRow(
  tenantId: string,
  slug: string,
  dbId: string | null,
  client: SupabaseClient
): Promise<ImagingProtocolTemplateRow> {
  const protocol = await loadResolvedProtocol(tenantId, slug, client);
  return {
    id: dbId ?? `resolved:${protocol.slug}`,
    tenant_id: null,
    slug: protocol.slug,
    name: protocol.name,
    description: protocol.description ?? null,
    slots: protocol.slots,
    protocol_catalog_source: protocol.metadata.source,
    protocol_catalog_version: protocol.metadata.version,
  };
}

export async function loadImagingOsPatientPayload(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<ImagingOsPatientPayload> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const bundle = await loadPatientImagesProfileBundle(tid, pid, supabase);

  const [
    { data: tplRows, error: tplErr },
    { data: sessRows, error: sessErr },
    { data: mapRows, error: mapErr },
  ] = await Promise.all([
    supabase
      .from("fi_imaging_protocol_templates")
      .select("id, tenant_id, slug, name, description, slots")
      .or(`tenant_id.eq.${tid},tenant_id.is.null`)
      .order("slug", { ascending: true }),
    supabase
      .from("fi_imaging_protocol_sessions")
      .select(
        "id, tenant_id, patient_id, case_id, consultation_id, template_slug, progress, created_at, updated_at"
      )
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("fi_imaging_scalp_maps")
      .select(
        "id, tenant_id, patient_id, consultation_id, case_id, title, state_json, created_at, updated_at"
      )
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const slugSet = new Set<string>(GUIDED_CAPTURE_TEMPLATE_SLUGS);
  const dbIdBySlug = new Map<string, string>();
  if (!tplErr && tplRows) {
    for (const r of tplRows) {
      const row = r as Record<string, unknown>;
      const slug = String(row.slug ?? "").trim();
      if (slug) {
        slugSet.add(slug);
        dbIdBySlug.set(slug, String(row.id));
      }
    }
  }

  const protocolSessions: ImagingProtocolSessionRow[] = [];
  if (!sessErr && sessRows) {
    for (const raw of sessRows) {
      const r = raw as Record<string, unknown>;
      const sessionSlug = String(r.template_slug ?? "").trim();
      if (sessionSlug) slugSet.add(sessionSlug);
    }
  }

  const protocolTemplates: ImagingProtocolTemplateRow[] = [];
  for (const slug of slugSet) {
    protocolTemplates.push(
      await resolveProtocolTemplateRow(tid, slug, dbIdBySlug.get(slug) ?? null, supabase)
    );
  }

  const templateBySlug = new Map(protocolTemplates.map((t) => [t.slug, t]));

  if (!sessErr && sessRows) {
    for (const raw of sessRows) {
      const r = raw as Record<string, unknown>;
      const progress =
        r.progress && typeof r.progress === "object" && !Array.isArray(r.progress)
          ? (r.progress as Record<string, unknown>)
          : {};
      const tpl = templateBySlug.get(String(r.template_slug ?? ""));
      const pct = tpl ? protocolRequiredCompletionPercent(tpl.slots, progress) : 0;
      protocolSessions.push({
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        patient_id: String(r.patient_id),
        case_id: r.case_id != null ? String(r.case_id) : null,
        consultation_id: r.consultation_id != null ? String(r.consultation_id) : null,
        template_slug: String(r.template_slug ?? ""),
        progress,
        completion_percent: pct,
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
      });
    }
  }

  const scalpMaps: ImagingScalpMapRow[] = [];
  if (!mapErr && mapRows) {
    for (const raw of mapRows) {
      const r = raw as Record<string, unknown>;
      const sj = r.state_json;
      scalpMaps.push({
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        patient_id: String(r.patient_id),
        consultation_id: r.consultation_id != null ? String(r.consultation_id) : null,
        case_id: r.case_id != null ? String(r.case_id) : null,
        title: String(r.title ?? "Scalp map"),
        state_json:
          sj && typeof sj === "object" && !Array.isArray(sj) ? (sj as Record<string, unknown>) : {},
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
      });
    }
  }

  const imageIds = bundle.activeWithSignedUrls.map((t) => t.image.id);
  const annotationsByImageId: Record<string, ImagingAnnotationRow> = {};
  if (imageIds.length > 0) {
    const { data: annRows, error: annErr } = await supabase
      .from("fi_imaging_annotation_sets")
      .select("patient_image_id, schema_version, payload, updated_at")
      .eq("tenant_id", tid)
      .in("patient_image_id", imageIds);
    if (!annErr && annRows) {
      for (const raw of annRows) {
        const r = raw as Record<string, unknown>;
        const iid = String(r.patient_image_id ?? "");
        const payload =
          r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
            ? (r.payload as Record<string, unknown>)
            : {};
        annotationsByImageId[iid] = {
          patient_image_id: iid,
          schema_version: String(r.schema_version ?? "imaging-annotation.v1"),
          payload,
          updated_at: String(r.updated_at ?? ""),
        };
      }
    }
  }

  let comparisonPairs: VieComparisonPairRow[] = [];
  try {
    const { generateVieComparisonPairsForPatient, loadVieComparisonPairsForPatient } =
      await import("@/src/lib/vie/vieLongitudinalComparison.server");
    await generateVieComparisonPairsForPatient({ tenantId: tid, patientId: pid, client: supabase });
    comparisonPairs = await loadVieComparisonPairsForPatient(tid, pid, { client: supabase });
  } catch {
    // best-effort — table may be unavailable during migration rollout
  }

  return {
    bundle,
    protocolTemplates,
    protocolSessions,
    scalpMaps,
    annotationsByImageId,
    comparisonPairs,
  };
}
