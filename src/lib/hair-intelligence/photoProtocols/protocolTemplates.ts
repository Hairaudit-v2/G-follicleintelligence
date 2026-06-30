import { DEFAULT_PHOTO_PROTOCOL_TEMPLATE_BY_CONTEXT } from "./protocolSeedTypes";
import type { HliPhotoProtocolClinicalContext, HliPhotoProtocolTemplate } from "./types";

export function resolveDefaultTemplateSlugForClinicalContext(
  context: HliPhotoProtocolClinicalContext
): string {
  return DEFAULT_PHOTO_PROTOCOL_TEMPLATE_BY_CONTEXT[context] ?? "consultation_standard";
}

export function templateLabelForSlug(
  slug: string,
  fallback: HliPhotoProtocolTemplate | null
): string {
  if (fallback?.slug === slug && fallback.name) return fallback.name;
  return slug.replace(/_/g, " ");
}
