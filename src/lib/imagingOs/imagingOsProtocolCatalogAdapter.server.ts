/**
 * @deprecated Legacy guided-capture adapter — protocol catalog resolution lives in
 * `src/lib/imaging-os/protocolCatalogResolver*`. Workspace loaders should use this
 * local adapter instead of importing canonical modules directly.
 */
import "server-only";

export {
  loadResolvedProtocol,
  loadResolvedProtocolSlots,
} from "@/src/lib/imaging-os/protocolCatalogResolver.server";
export type {
  NormalizedProtocol,
  ProtocolCatalogSource,
} from "@/src/lib/imaging-os/protocolCatalogResolverCore";
