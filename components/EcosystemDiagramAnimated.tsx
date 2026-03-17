"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { EcosystemSiteId } from "@/lib/site-navigation";
import { ECOSYSTEM_DIAGRAM_NODES } from "@/lib/site-navigation";

export type EcosystemDiagramVariant = "default" | "follicleintelligence";

export interface EcosystemDiagramAnimatedProps {
  /** Current site for emphasis (e.g. highlight central node on FI site). */
  currentSite?: EcosystemSiteId;
  /** Enable entrance and line-draw animations. */
  animated?: boolean;
  /** Visual treatment: "follicleintelligence" = premium dark/cinematic, stronger depth and motion. */
  variant?: EcosystemDiagramVariant;
  className?: string;
}

export function EcosystemDiagramAnimated({
  currentSite = "follicleintelligence",
  animated = true,
  variant = "default",
  className,
}: EcosystemDiagramAnimatedProps) {
  const { central, satellites } = ECOSYSTEM_DIAGRAM_NODES;
  const isCentralCurrent = currentSite === central.id;
  const isPremium = variant === "follicleintelligence";

  const centralTransition = {
    duration: isPremium ? 0.6 : 0.45,
    delay: 0.1,
    ease: "easeOut" as const,
  };
  const satelliteTransition = (index: number) => ({
    duration: isPremium ? 0.55 : 0.4,
    delay: 0.08 * (index + 1),
    ease: "easeOut" as const,
  });
  const satelliteInitial = animated ? { opacity: 0, y: isPremium ? 20 : 14 } : undefined;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        isPremium && "rounded-[1.75rem] border border-border/40 bg-gradient-to-b from-background/95 to-background/88 shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
        className
      )}
      role="img"
      aria-label="Hair Intelligence ecosystem: Follicle Intelligence central engine with HairAudit, Hair Longevity Institute, and IIOHR"
    >
      {isPremium && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_55%,hsl(var(--primary)/0.08),transparent_55%)]"
          aria-hidden
        />
      )}
      <div className="relative mx-auto grid max-w-3xl grid-cols-1 gap-8 py-8 sm:grid-cols-3 sm:gap-10 md:gap-12 md:py-12">
        {/* Central node — full width on mobile, then centered below satellites on sm+ */}
        <div className="order-2 flex justify-center sm:col-span-3 sm:order-2">
          <motion.div
            initial={animated ? { opacity: 0, scale: isPremium ? 0.92 : 0.96 } : undefined}
            whileInView={animated ? { opacity: 1, scale: 1 } : undefined}
            viewport={{ once: true }}
            transition={centralTransition}
            className="w-full max-w-sm"
          >
            <Link
              href={central.href}
              className={cn(
                "fi-panel block rounded-[1.5rem] border-2 p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isCentralCurrent
                  ? "border-primary/40 shadow-[0_0_32px_hsl(var(--primary)/0.12)]"
                  : "border-border/60 hover:border-primary/25",
                isPremium &&
                  isCentralCurrent &&
                  "shadow-[0_0_40px_hsl(var(--primary)/0.15),0_0_80px_hsl(var(--primary)/0.06),inset_0_1px_0_rgba(255,255,255/0.06)]"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/90">
                {central.roleLabel}
              </p>
              <p className="mt-3 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {central.label}
              </p>
            </Link>
          </motion.div>
        </div>

        {/* Satellite nodes */}
        {satellites.map((node, index) => {
          const isCurrent = currentSite === node.id;
          const isExternal = node.href.startsWith("http");
          const content = (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                {node.roleLabel}
              </p>
              <p className="mt-2 text-base font-semibold tracking-tight text-foreground md:text-lg">
                {node.label}
              </p>
            </>
          );
          const wrapperClass = cn(
            "fi-panel-muted block rounded-[1.35rem] border p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isCurrent ? "border-primary/30" : "border-border/60 hover:border-primary/20",
            isPremium && "shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          );

          return (
            <motion.div
              key={node.id}
              initial={satelliteInitial}
              whileInView={animated ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true }}
              transition={satelliteTransition(index)}
              className="order-1 flex justify-center sm:order-1"
            >
              {isExternal ? (
                <a
                  href={node.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={wrapperClass}
                >
                  {content}
                </a>
              ) : (
                <Link href={node.href} className={wrapperClass}>
                  {content}
                </Link>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
