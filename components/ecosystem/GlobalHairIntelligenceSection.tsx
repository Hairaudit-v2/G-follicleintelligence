"use client";

import { GlobalHairIntelligenceNetwork } from "@/components/ecosystem/GlobalHairIntelligenceNetwork";
import type { GlobalNetworkTheme, GlobalNetworkVariant } from "@/components/ecosystem/GlobalHairIntelligenceNetwork";
import { GLOBAL_NETWORK_NODE_LINKS } from "@/components/ecosystem/constants";

export type { GlobalNetworkVariant };

export interface GlobalHairIntelligenceSectionProps {
  /** Which ecosystem site is rendering (HLI, HairAudit, Follicle Intelligence, IIOHR). */
  variant: GlobalNetworkVariant;
  /** Section heading (site-specific). */
  heading: string;
  /** Short explanatory copy below the heading (site-specific). */
  description: string;
  /** "hero" = large feature section; "compact" = smaller for secondary pages. */
  size?: "hero" | "compact";
  /** Light or dark theme for the network. Default follows light section styling. */
  theme?: GlobalNetworkTheme;
  /** Optional id for the section (e.g. for anchor links). */
  id?: string;
  /** Optional className for the section wrapper. */
  className?: string;
  /** Override node links (default: canonical ecosystem URLs). */
  nodeLinks?: Partial<Record<"hli" | "hairaudit" | "fi" | "iiohr", string>>;
}

/**
 * Reusable section wrapper for the Global Hair Intelligence Network.
 * Use on homepage (size="hero") or secondary pages (size="compact").
 * Copy and supporting text are passed in so the component stays brand-neutral.
 */
export function GlobalHairIntelligenceSection({
  variant,
  heading,
  description,
  size = "hero",
  theme = "light",
  id = "global-hair-intelligence-network",
  className = "",
  nodeLinks = GLOBAL_NETWORK_NODE_LINKS,
}: GlobalHairIntelligenceSectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 border-t border-border/50 bg-muted/30 py-12 sm:py-16 md:py-20 ${className}`}
      aria-labelledby={`${id}-heading`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2
          id={`${id}-heading`}
          className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl"
        >
          {heading}
        </h2>
        <p
          className="mx-auto mt-4 max-w-xl text-center text-muted-foreground leading-relaxed"
        >
          {description}
        </p>
        <div className="mx-auto mt-8 min-h-[520px] w-full max-w-[min(1000px,100%)] overflow-visible md:min-h-[640px] lg:min-h-[720px]">
          <GlobalHairIntelligenceNetwork
            variant={variant}
            highlightNode={variant}
            interactive
            theme={theme}
            showBackground={false}
            size={size}
            title="Global Hair Intelligence Network"
            nodeLinks={nodeLinks}
          />
        </div>
      </div>
    </section>
  );
}
