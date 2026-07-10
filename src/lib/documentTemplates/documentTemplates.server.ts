import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  DOCUMENT_TEMPLATE_CATEGORIES,
  DOCUMENT_TEMPLATE_DEFAULTS,
  type DocumentTemplateCategory,
} from "./documentTemplateConstants";
import type { FiDocumentTemplateRow } from "./documentTemplateTypes";

function assertMetadataObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function mapRow(row: Record<string, unknown>): FiDocumentTemplateRow {
  const category = String(row.category ?? "").trim();
  if (!(DOCUMENT_TEMPLATE_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`Invalid document template category: ${category}`);
  }
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    category: category as DocumentTemplateCategory,
    slug: String(row.slug),
    name: String(row.name),
    body: String(row.body),
    is_default: Boolean(row.is_default),
    is_active: Boolean(row.is_active),
    version: Number(row.version ?? 1) || 1,
    metadata: assertMetadataObject(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadDocumentTemplatesForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<FiDocumentTemplateRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabase
    .from("fi_document_templates")
    .select("*")
    .eq("tenant_id", tid)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/** Insert default catalogue rows for missing slugs only (never overwrites edits). */
export async function ensureDefaultDocumentTemplatesForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<{ created: number }> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const existing = await loadDocumentTemplatesForTenant(tid, supabase);
  const have = new Set(existing.map((r) => `${r.category}::${r.slug}`));
  const now = new Date().toISOString();
  const rows = DOCUMENT_TEMPLATE_DEFAULTS.filter(
    (d) => !have.has(`${d.category}::${d.slug}`)
  ).map((d) => ({
    tenant_id: tid,
    category: d.category,
    slug: d.slug,
    name: d.name,
    body: d.body,
    is_default: d.is_default ?? true,
    is_active: true,
    version: 1,
    metadata: {},
    created_at: now,
    updated_at: now,
  }));
  if (rows.length === 0) return { created: 0 };
  const { error } = await supabase.from("fi_document_templates").insert(rows);
  if (error) throw new Error(error.message);
  return { created: rows.length };
}

export type UpsertDocumentTemplateParams = {
  tenantId: string;
  id?: string | null;
  category: DocumentTemplateCategory;
  slug: string;
  name: string;
  body: string;
  is_default?: boolean;
  is_active?: boolean;
};

export async function upsertDocumentTemplate(
  params: UpsertDocumentTemplateParams,
  client?: SupabaseClient
): Promise<FiDocumentTemplateRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const now = new Date().toISOString();
  const slug = params.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!slug) throw new Error("slug is required");
  const name = params.name.trim();
  const body = params.body.trim();
  if (!name) throw new Error("name is required");
  if (!body) throw new Error("body is required");

  if (params.id?.trim()) {
    const id = assertNonEmptyUuid(params.id, "id");
    const { data: prev } = await supabase
      .from("fi_document_templates")
      .select("version")
      .eq("tenant_id", tid)
      .eq("id", id)
      .maybeSingle();
    const nextVersion = Number((prev as { version?: number } | null)?.version ?? 1) + 1;
    const { data, error } = await supabase
      .from("fi_document_templates")
      .update({
        category: params.category,
        slug,
        name,
        body,
        is_default: params.is_default ?? false,
        is_active: params.is_active ?? true,
        version: nextVersion,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("fi_document_templates")
    .upsert(
      {
        tenant_id: tid,
        category: params.category,
        slug,
        name,
        body,
        is_default: params.is_default ?? false,
        is_active: params.is_active ?? true,
        version: 1,
        metadata: {},
        created_at: now,
        updated_at: now,
      },
      { onConflict: "tenant_id,category,slug" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteDocumentTemplate(
  tenantId: string,
  templateId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const id = assertNonEmptyUuid(templateId, "templateId");
  const { error } = await supabase
    .from("fi_document_templates")
    .delete()
    .eq("tenant_id", tid)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
