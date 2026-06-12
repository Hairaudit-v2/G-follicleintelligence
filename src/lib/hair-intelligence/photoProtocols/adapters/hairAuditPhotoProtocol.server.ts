import "server-only";

import type { HliPhotoProtocolClinicalContext, HliPhotoProtocolComplianceSummary } from "../types";
import { calculatePhotoProtocolCompliance } from "../protocolCompliance";
import { loadTemplateWithSlotsBySlug } from "../protocolSession.server";

/**
 * HairAudit placeholder: load template + compute compliance for audit case images (no session persistence here).
 */
export async function hairAuditPhotoProtocolComplianceForCase(params: {
  templateSlug?: string;
  images: Parameters<typeof calculatePhotoProtocolCompliance>[0]["images"];
}): Promise<HliPhotoProtocolComplianceSummary | null> {
  const slug = params.templateSlug?.trim() || "hairaudit_case_standard";
  const loaded = await loadTemplateWithSlotsBySlug(slug);
  if (!loaded) return null;
  return calculatePhotoProtocolCompliance({
    template: loaded.template,
    slots: loaded.slots,
    images: params.images,
  });
}

export function hairAuditPhotoProtocolClinicalContextDefault(): HliPhotoProtocolClinicalContext {
  return "hairaudit_case";
}
