"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const CENTRAL = "Follicle Intelligence";

const SATELLITES = [
  "HairAudit",
  "Hair Longevity Institute",
  "IIOHR",
  "Patient Twin",
  "SurgeryOS",
  "ClinicOS",
  "AnalyticsOS",
] as const;

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: 50 + radiusPct * Math.cos(angle),
    y: 50 + radiusPct * Math.sin(angle),
  };
}

export function FiHeroEcosystemViz() {
  const reduceMotion = useReducedMotion();

  const nodes = useMemo(() => {
    const r = 38;
    return SATELLITES.map((label, i) => ({
      label,
      ...polarToPct(i, SATELLITES.length, r),
      delay: i * 0.12,
    }));
  }, []);

  return (
    <div
      className="relative mx-auto w-full max-w-[min(100%,520px)]"
      role="img"
      aria-label="Follicle Intelligence at the centre of an ecosystem: HairAudit, Hair Longevity Institute, IIOHR, Patient Twin, SurgeryOS, ClinicOS, and AnalyticsOS, with animated data connections."
    >
      <div
        className="relative aspect-[1/1.05] min-h-[320px] w-full overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-[rgb(12_18_28_/0.92)] via-[rgb(8_13_22_/0.88)] to-[rgb(6_10_18_/0.95)] shadow-[0_24px_80px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-xl sm:min-h-[380px] md:min-h-[420px]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,hsl(var(--primary)/0.14),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgb(120_160_200_/0.08),transparent_40%)]" />

        <svg
          className="absolute inset-0 h-full w-full text-primary"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {nodes.map((n) => (
            <g key={n.label}>
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="rgb(56 178 232 / 0.1)"
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
                    ? "text-primary/25"
                    : "fi-hero-network-line-out text-primary/45 [animation-duration:3.4s]"
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
                    ? "text-sky-300/15"
                    : "fi-hero-network-line-in text-sky-300/35 [animation-duration:2.6s]"
                }
              />
            </g>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="w-[min(88vw,220px)] rounded-2xl border border-white/[0.12] bg-[rgb(10_16_26_/0.55)] px-4 py-3.5 text-center shadow-[0_0_40px_hsl(var(--primary)/0.18),inset_0_1px_0_rgb(255_255_255_/0.08)] backdrop-blur-md sm:w-[min(88%,220px)] sm:px-5 sm:py-4"
            animate={
              reduceMotion
                ? {}
                : {
                    y: [0, -5, 0],
                    boxShadow: [
                      "0 0 36px hsl(var(--primary) / 0.14), inset 0 1px 0 rgb(255 255 255 / 0.08)",
                      "0 0 52px hsl(var(--primary) / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.1)",
                      "0 0 36px hsl(var(--primary) / 0.14), inset 0 1px 0 rgb(255 255 255 / 0.08)",
                    ],
                  }
            }
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-primary/85">Intelligence core</p>
            <p className="mt-1.5 font-display text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
              {CENTRAL}
            </p>
          </motion.div>
        </div>

        {nodes.map((n) => (
          <div
            key={n.label}
            className="absolute z-10 max-w-[38%] sm:max-w-[34%]"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -3, 0] }}
              transition={{
                duration: 4.5 + n.delay * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: n.delay,
              }}
            >
              <div className="rounded-xl border border-white/[0.09] bg-[rgb(8_13_22_/0.5)] px-2 py-1.5 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-sm sm:px-2.5 sm:py-2">
                <p
                  className={`font-medium leading-tight text-foreground/95 ${
                    n.label === "Hair Longevity Institute"
                      ? "text-[9px] sm:text-[10px]"
                      : "text-[10px] sm:text-[11px]"
                  }`}
                >
                  {n.label}
                </p>
              </div>
            </motion.div>
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(5_8_14_/0.85)] to-transparent" />
      </div>
    </div>
  );
}
