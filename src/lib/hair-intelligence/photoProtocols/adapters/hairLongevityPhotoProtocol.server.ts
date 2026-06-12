import "server-only";

import type { HliPhotoProtocolClinicalContext, HliPhotoProtocolComplianceSummary } from "../types";
import { calculatePhotoProtocolCompliance } from "../protocolCompliance";
import { loadTemplateWithSlotsBySlug } from "../protocolSession.server";

/**
 * Hair Longevity placeholder: intake/progress compliance without FI session tables.
 */
export async function hairLongevityPhotoProtocolCompliance(params: {
  phase: "intake" | "progress";
  images: Parameters<typeof calculatePhotoProtocolCompliance>[0]["images"];
}): Promise<HliPhotoProtocolComplianceSummary | null> {
  const slug = params.phase === "intake" ? "hli_intake_standard" : "follow_up_standard";
  const loaded = await loadTemplateWithSlotsBySlug(slug);
  if (!loaded) return null;
  return calculatePhotoProtocolCompliance({
    template: loaded.template,
    slots: loaded.slots,
    images: params.images,
  });
}

export function hairLongevityClinicalContext(phase: "intake" | "progress"): HliPhotoProtocolClinicalContext {
  return phase === "intake" ? "hli_intake" : "hli_progress";
}
