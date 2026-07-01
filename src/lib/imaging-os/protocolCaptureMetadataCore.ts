/**
 * ImagingOS Phase 6 — protocol catalog metadata for capture uploads.
 */

import type { NormalizedProtocol } from "./protocolCatalogResolverCore";

export function buildProtocolCatalogCaptureMetadata(
  protocol: Pick<NormalizedProtocol, "slug" | "metadata">
): Record<string, unknown> {
  return {
    protocol_template_slug: protocol.slug,
    protocol_catalog_source: protocol.metadata.source,
    protocol_catalog_version: protocol.metadata.version,
  };
}