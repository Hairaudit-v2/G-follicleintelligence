import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTenantBranding } from "@/src/lib/fi/foundation/tenantSettings";
import {
  parseImagingQualityPolicyFromTenantMetadata,
  type ImagingQualityTenantPolicy,
} from "./imageQualityPolicy";

export async function loadImagingQualityPolicyForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<ImagingQualityTenantPolicy> {
  try {
    const settings = await loadTenantBranding(tenantId.trim(), client);
    return parseImagingQualityPolicyFromTenantMetadata(settings?.metadata ?? {});
  } catch {
    return parseImagingQualityPolicyFromTenantMetadata({});
  }
}