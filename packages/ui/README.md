# `@/packages/ui` — Follicle Intelligence Network UI

Shared marketing primitives for FI ecosystem sites (Follicle Intelligence, HairAudit, HLI, IIOHR). Evolved Hair is intentionally out of scope.

## Usage

```tsx
import {
  PlatformNav,
  EcosystemFooter,
  Hero,
  NETWORK_PRODUCTS,
  type NetworkProductSlug,
} from "@/packages/ui";

const href = (slug: NetworkProductSlug) => {
  // map slug → absolute URL per deployment
  return `https://example.com/${slug}`;
};

export function SiteShell({ current }: { current: NetworkProductSlug }) {
  return (
    <>
      <PlatformNav currentPlatform={current} resolveProductHref={href} brand="HairAudit" cta={/* ... */} />
      {/* page */}
      <EcosystemFooter resolveProductHref={href} legalLinks={[{ label: "Privacy", href: "/privacy" }]} />
    </>
  );
}
```

- Supply **copy via props** (titles, descriptions, FAQs). Avoid hardcoding marketing strings inside primitives where possible.
- Use `platform` on `Hero` / `NetworkButton` for accent hover hints.
- For **HLI light** clinical shells, `platformSurfaceClasses("hli", "light")`.

## Internal demo

`/design-system` — robots `noindex`. Remove or protect in production if desired.
