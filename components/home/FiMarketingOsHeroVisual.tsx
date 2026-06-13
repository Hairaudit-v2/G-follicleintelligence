"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

import type { HomeOrbitModule } from "@/lib/marketing/homePageContent";

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: 50 + radiusPct * Math.cos(angle),
    y: 50 + radiusPct * Math.sin(angle),
  };
}

export interface FiMarketingOsHeroVisualProps {
  modules: readonly HomeOrbitModule[];
  coreEyebrow: string;
  coreTitle: string;
}

export function FiMarketingOsHeroVisual({ modules, coreEyebrow, coreTitle }: FiMarketingOsHeroVisualProps) {
  const reduceMotion = useReducedMotion();

  const nodes = useMemo(() => {
    const r = 38;
    return modules.map((m, i) => ({
      label: m.label,
      subtitle: m.subtitle,
      key: m.label,
      ...polarToPct(i, modules.length, r),
      delay: i * 0.1,
    }));
  }, [modules]);

  const ariaLabel = `${coreTitle} at the centre, connected to ${modules.map((m) => m.label).join(", ")}.`;

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,560px)]" role="img" aria-label={ariaLabel}>
      <div
        className="relative aspect-[1/1.05] min-h-[300px] w-full overflow-hidden rounded-[1.75rem] border border-amber-400/12 bg-gradient-to-br from-[rgb(16_20_32_/0.97)] via-[rgb(8_12_20_/0.94)] to-[rgb(4_7_12_/0.98)] shadow-[0_32px_100px_rgb(0_0_0_/0.55),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-xl sm:min-h-[360px] md:min-h-[400px]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,hsl(var(--primary)/0.14),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_10%,rgb(212_175_55_/0.09),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_88%_16%,rgb(120_160_200_/0.07),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(212_175_55_/0.05),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent" />

        <svg
          className="absolute inset-0 h-full w-full text-amber-200/35"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {nodes.map((n) => (
            <g key={n.key}>
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="rgb(212 175 55 / 0.08)"
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.35"
                strokeDasharray="0.9 2.2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-amber-200/20"
                    : "fi-hero-network-line-out text-amber-200/40 [animation-duration:3.4s]"
                }
              />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.28"
                strokeDasharray="0.55 1.8"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-primary/15"
                    : "fi-hero-network-line-in text-primary/30 [animation-duration:2.6s]"
                }
              />
            </g>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="w-[min(88vw,248px)] rounded-2xl border border-amber-300/25 bg-[rgb(10_14_22_/0.72)] px-4 py-4 text-center shadow-[0_0_52px_rgb(212_175_55_/0.14),inset_0_1px_0_rgb(255_255_255_/0.1)] ring-1 ring-amber-400/10 backdrop-blur-md sm:w-[min(88%,248px)] sm:px-5 sm:py-4"
            animate={
              reduceMotion
                ? {}
                : {
                    y: [0, -5, 0],
                    boxShadow: [
                      "0 0 40px rgb(212 175 55 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.08)",
                      "0 0 56px rgb(212 175 55 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.1)",
                      "0 0 40px rgb(212 175 55 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.08)",
                    ],
                  }
            }
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-amber-200/90">{coreEyebrow}</p>
            <p className="mt-2 font-display text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
              {coreTitle}
            </p>
          </motion.div>
        </div>

        {nodes.map((n) => (
          <div
            key={n.key}
            className="absolute z-10 max-w-[40%] sm:max-w-[36%]"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -3, 0] }}
              transition={{
                duration: 4.5 + n.delay * 0.45,
                repeat: Infinity,
                ease: "easeInOut",
                delay: n.delay,
              }}
            >
              <div className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-[rgb(8_12_20_/0.62)] px-2.5 py-2 text-center shadow-[0_12px_32px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-md transition-[border-color,box-shadow] duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-300/45 before:to-transparent hover:border-amber-300/25 hover:shadow-[0_14px_36px_rgb(212_175_55_/0.08)] sm:px-3 sm:py-2.5">
                <p className="text-[10px] font-semibold leading-tight text-foreground/95 sm:text-[11px]">{n.label}</p>
                <p className="mt-0.5 text-[8px] font-medium leading-snug text-amber-100/75 sm:text-[9px]">
                  {n.subtitle}
                </p>
              </div>
            </motion.div>
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(5_8_14_/0.9)] to-transparent" />
      </div>
    </div>
  );
}
