/**
 * Server-only workspace bridge — protocol catalog loaders for imagingOs workspace loaders.
 */

import "server-only";

export { loadResolvedProtocol, loadResolvedProtocolSlots } from "./protocolCatalogResolver.server";
export type { NormalizedProtocol, ProtocolCatalogSource } from "./protocolCatalogResolverCore";
