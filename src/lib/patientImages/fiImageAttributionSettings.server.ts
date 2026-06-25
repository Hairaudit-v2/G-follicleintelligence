import "server-only";

import { loadTenantBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { parseFiImageAttributionSettings } from "./fiImageAttributionCore";
import type { FiImageAttributionSettings } from "./fiImageAttributionTypes";

export async function loadFiImageAttributionSettings(tenantId: string): Promise<FiImageAttributionSettings> {
  const tenantSettings = await loadTenantBranding(tenantId.trim());
  return parseFiImageAttributionSettings(tenantSettings?.metadata ?? {});
}
