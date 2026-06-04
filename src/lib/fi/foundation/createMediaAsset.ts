import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "./internal";
import type {
  CreateMediaAssetInput,
  CreateMediaAssetResult,
  FoundationSupabase,
} from "./types";

function fileNameFromPath(storagePath: string, fileName?: string | null): string {
  if (fileName?.trim()) return fileName.trim();
  const parts = storagePath.split("/");
  const last = parts[parts.length - 1];
  return last?.trim() ? last : "file";
}

/**
 * Idempotent insert into fi_media_assets by (tenant_id, storage_path) or
 * (tenant_id, source_system, source_asset_id) when both source fields are set.
 * Does not touch fi_uploads.
 */
export async function createMediaAsset(
  input: CreateMediaAssetInput,
  client?: FoundationSupabase
): Promise<CreateMediaAssetResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const storagePath = input.storage_path.trim();
  const sourceSystem = input.source_system?.trim() || null;
  const sourceAssetId = input.source_asset_id?.trim() || null;

  if (sourceSystem && sourceAssetId) {
    const bySource = await supabase
      .from("fi_media_assets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_asset_id", sourceAssetId)
      .maybeSingle();
    if (bySource.error) throw new Error(bySource.error.message);
    if (bySource.data?.id) return { id: String(bySource.data.id), created: false };
  }

  const byPath = await supabase
    .from("fi_media_assets")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (byPath.error) throw new Error(byPath.error.message);
  if (byPath.data?.id) return { id: String(byPath.data.id), created: false };

  const metadata = shallowMergeMetadata(
    {
      ...(input.metadata ?? {}),
      resolution_source: "foundation_createMediaAsset",
      ...(input.person_id ? { person_id: input.person_id } : {}),
      ...(input.clinic_id ? { clinic_id: input.clinic_id } : {}),
      ...(input.organisation_id ? { organisation_id: input.organisation_id } : {}),
    },
    null
  );

  const inserted = await supabase
    .from("fi_media_assets")
    .insert({
      tenant_id: tenantId,
      case_id: input.case_id?.trim() || null,
      patient_id: input.foundation_patient_id?.trim() || null,
      asset_type: input.asset_type.trim(),
      filename: fileNameFromPath(storagePath, input.file_name),
      storage_path: storagePath,
      mime_type: input.mime_type?.trim() || null,
      size_bytes: typeof input.size_bytes === "number" && Number.isFinite(input.size_bytes) ? input.size_bytes : null,
      source_system: sourceSystem,
      source_asset_id: sourceAssetId,
      metadata,
    })
    .select("id")
    .single();

  if (inserted.error?.code === "23505") {
    const retry = await supabase
      .from("fi_media_assets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (retry.data?.id) return { id: String(retry.data.id), created: false };
  }

  if (inserted.error) throw new Error(inserted.error.message);
  return { id: String((inserted.data as { id: string }).id), created: true };
}
