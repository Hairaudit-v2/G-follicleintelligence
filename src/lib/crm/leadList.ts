import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapFiCrmLeadRow } from "./leadRow";
import type { CrmShellLeadListItem, CrmShellLeadListPage } from "./types";
import type { ParsedCrmLeadListQuery } from "./crmLeadListQuery";
import { crmLeadListOffset } from "./crmLeadListQuery";

function mapStage(v: unknown): CrmShellLeadListItem["stage"] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;
  return {
    id,
    slug: String(o.slug ?? ""),
    label: String(o.label ?? ""),
    sort_order: Number(o.sort_order ?? 0),
  };
}

function mapPerson(v: unknown): CrmShellLeadListItem["person"] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;
  const meta =
    o.metadata && typeof o.metadata === "object" && !Array.isArray(o.metadata)
      ? (o.metadata as Record<string, unknown>)
      : {};
  return { id, metadata: meta };
}

function mapOwner(v: unknown): CrmShellLeadListItem["owner"] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;
  return { id, email: o.email != null ? String(o.email) : null };
}

function mapPatient(v: unknown): CrmShellLeadListItem["patient"] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;
  return { id };
}

/**
 * Tenant-scoped lead index page via `fi_crm_leads_shell_page` (service role).
 * Call only after CRM shell route access checks.
 */
export async function loadCrmLeadsShellPage(
  tenantId: string,
  parsed: ParsedCrmLeadListQuery,
  client?: SupabaseClient
): Promise<CrmShellLeadListPage> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const offset = crmLeadListOffset(parsed);

  const { data, error } = await supabase.rpc("fi_crm_leads_shell_page", {
    p_tenant_id: tid,
    p_stage_id: parsed.stageId,
    p_status: parsed.status,
    p_priority: parsed.priority,
    p_owner_user_id: parsed.ownerUserId,
    p_search_pattern: parsed.searchPattern,
    p_sort: parsed.sort,
    p_limit: parsed.pageSize,
    p_offset: offset,
    p_updated_at_min: parsed.updatedAtMin,
    p_updated_at_max: parsed.updatedAtMax,
  });

  if (error) throw new Error(error.message);

  const root = data as { total?: unknown; items?: unknown } | null;
  const totalRaw = root?.total;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw)
      ? Math.max(0, totalRaw)
      : typeof totalRaw === "string" && totalRaw.trim() !== ""
        ? Math.max(0, Number.parseInt(totalRaw, 10) || 0)
        : 0;
  const rawItems = Array.isArray(root?.items) ? root.items : [];

  const items: CrmShellLeadListItem[] = rawItems.map((row) => {
    const r = row as Record<string, unknown>;
    const leadJson = r.lead;
    if (!leadJson || typeof leadJson !== "object" || Array.isArray(leadJson)) {
      throw new Error("Invalid fi_crm_leads_shell_page row: missing lead.");
    }
    return {
      lead: mapFiCrmLeadRow(leadJson as Record<string, unknown>),
      stage: mapStage(r.stage),
      person: mapPerson(r.person),
      owner: mapOwner(r.owner),
      patient: mapPatient(r.patient),
    };
  });

  return { items, total };
}
