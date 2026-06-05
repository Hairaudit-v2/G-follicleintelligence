import type { StaticImageData } from "next/image";

import { safeLogoUrlForImg } from "@/src/lib/fi/foundation/brandingCss";

import { resolvePublicStaticImage } from "./publicImages";

export type TenantLogoSource =
  | { kind: "static"; image: StaticImageData }
  | { kind: "remote"; url: string };

/**
 * Resolves tenant `logo_url` for Next.js `Image`: bundled public assets first, then http(s) URLs.
 */
export function resolveTenantLogoSource(logoUrl: string | null | undefined): TenantLogoSource | null {
  const local = resolvePublicStaticImage(logoUrl);
  if (local) return { kind: "static", image: local };

  const remote = safeLogoUrlForImg(logoUrl);
  if (remote) return { kind: "remote", url: remote };

  return null;
}
