/** HairAudit inbound image MIME allow-list (Phase 3F contract). */
export const HAIRAUDIT_SUPPORTED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type HairauditSupportedImageContentType =
  (typeof HAIRAUDIT_SUPPORTED_IMAGE_CONTENT_TYPES)[number];

export function isValidHairauditImageContentType(
  value: string
): value is HairauditSupportedImageContentType {
  return (HAIRAUDIT_SUPPORTED_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}
