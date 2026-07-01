import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseProtocolSlots } from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  resolveProtocolCatalog,
  type HliProtocolTemplateInput,
  type NormalizedProtocol,
  type TenantDbTemplateInput,
} from "./protocolCatalogResolverCore";

async function loadTenantDbTemplate(
  tenantId: string,
  templateSlug: string,
  client: SupabaseClient
): Promise<TenantDbTemplateInput | null> {
  const tid = tenantId.trim();
  const slug = templateSlug.trim();

  const { data: tenantRow, error: tenantErr } = await client
    .from("fi_imaging_protocol_templates")
    .select("slug, name, description, slots, tenant_id")
    .eq("tenant_id", tid)
    .eq("slug", slug)
    .maybeSingle();
  if (tenantErr) throw new Error(tenantErr.message);
  if (tenantRow) {
    const r = tenantRow as Record<string, unknown>;
    const slots = parseProtocolSlots(r.slots);
    if (slots.length > 0) {
      return {
        slug: String(r.slug ?? slug),
        name: String(r.name ?? slug),
        description: r.description != null ? String(r.description) : null,
        slots,
        tenant_id: tid,
      };
    }
  }

  const { data: globalRow, error: globalErr } = await client
    .from("fi_imaging_protocol_templates")
    .select("slug, name, description, slots, tenant_id")
    .is("tenant_id", null)
    .eq("slug", slug)
    .maybeSingle();
  if (globalErr) throw new Error(globalErr.message);
  if (!globalRow) return null;

  const r = globalRow as Record<string, unknown>;
  const slots = parseProtocolSlots(r.slots);
  if (!slots.length) return null;
  return {
    slug: String(r.slug ?? slug),
    name: String(r.name ?? slug),
    description: r.description != null ? String(r.description) : null,
    slots,
    tenant_id: null,
  };
}

async function loadHliTemplate(
  templateSlug: string,
  client: SupabaseClient
): Promise<HliProtocolTemplateInput | null> {
  const slug = templateSlug.trim();
  const { data: tpl, error: tplErr } = await client
    .from("hli_photo_protocol_templates")
    .select("id, slug, name, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (tplErr || !tpl) return null;

  const templateId = String((tpl as { id: string }).id);
  const { data: slotRows, error: slotErr } = await client
    .from("hli_photo_protocol_slots")
    .select("slot_slug, label, is_required, capture_guidance, required_image_category")
    .eq("protocol_template_id", templateId)
    .order("sort_order", { ascending: true });
  if (slotErr) throw new Error(slotErr.message);

  const slots = (slotRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      slot_slug: String(r.slot_slug ?? ""),
      label: String(r.label ?? ""),
      is_required: Boolean(r.is_required),
      capture_guidance: r.capture_guidance != null ? String(r.capture_guidance) : null,
      required_image_category:
        r.required_image_category != null ? String(r.required_image_category) : null,
    };
  });

  const t = tpl as Record<string, unknown>;
  return {
    slug: String(t.slug ?? slug),
    name: String(t.name ?? slug),
    description: t.description != null ? String(t.description) : null,
    slots,
  };
}

/**
 * Resolve a protocol template for a tenant using the Phase 5 priority chain:
 * tenant DB → ImagingOS canonical → HLI mapping → VIE legacy.
 */
export async function loadResolvedProtocol(
  tenantId: string,
  templateSlug: string,
  client?: SupabaseClient
): Promise<NormalizedProtocol> {
  const supabase = client ?? supabaseAdmin();
  const slug = templateSlug.trim();

  const tenantDbTemplate = await loadTenantDbTemplate(tenantId, slug, supabase);

  let hliTemplate = await loadHliTemplate(slug, supabase);
  if (!hliTemplate) {
    const { HLI_TO_CANONICAL_PROTOCOL_SLUG } = await import("./protocolCatalogResolverCore");
    for (const [hliSlug, canonicalSlug] of Object.entries(HLI_TO_CANONICAL_PROTOCOL_SLUG)) {
      if (canonicalSlug === slug) {
        hliTemplate = await loadHliTemplate(hliSlug, supabase);
        if (hliTemplate) break;
      }
    }
  }

  return resolveProtocolCatalog({
    templateSlug: slug,
    tenantDbTemplate,
    hliTemplate,
  });
}

/** Convenience helper returning slots + name for completeness / capture flows. */
export async function loadResolvedProtocolSlots(
  tenantId: string,
  templateSlug: string,
  client?: SupabaseClient
): Promise<{ name: string; slots: NormalizedProtocol["slots"]; protocol: NormalizedProtocol }> {
  const protocol = await loadResolvedProtocol(tenantId, templateSlug, client);
  return { name: protocol.name, slots: protocol.slots, protocol };
}