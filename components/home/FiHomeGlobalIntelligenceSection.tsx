"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BarChart3,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Stethoscope,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const STREAMS: { label: string; Icon: LucideIcon }[] = [
  { label: "Clinical Data", Icon: Stethoscope },
  { label: "Surgical Data", Icon: Activity },
  { label: "Outcome Data", Icon: HeartPulse },
  { label: "Training Data", Icon: GraduationCap },
  { label: "Business Data", Icon: BarChart3 },
  { label: "Patient Experience Data", Icon: Users },
];

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return { x: 50 + radiusPct * Math.cos(angle), y: 50 + radiusPct * Math.sin(angle) };
}

function NetworkCoreVisual() {
  const reduceMotion = useReducedMotion();

  const nodes = useMemo(() => {
    const r = 37;
    return STREAMS.map((s, i) => ({
      ...s,
      ...polarToPct(i, STREAMS.length, r),
      delay: i * 0.08,
    }));
  }, []);

  return (
    <div
      className="relative mx-auto w-full max-w-4xl"
      role="img"
      aria-label="Diagram: six data streams flowing into the Follicle Intelligence core, representing how clinic signal compounds into network intelligence."
    >
      <div
        className={cn(
          "relative aspect-[4/3] min-h-[300px] w-full overflow-hidden rounded-[1.85rem] border border-white/[0.09]",
          "bg-gradient-to-b from-[rgb(10_16_26_/0.92)] via-[rgb(6_10_17_/0.9)] to-[rgb(4_7_12_/0.96)]",
          "shadow-[0_28px_90px_rgb(0_0_0_/0.48),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-xl",
          "sm:min-h-[340px] md:aspect-[16/10] md:min-h-[380px]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,hsl(var(--primary)/0.15),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgb(70_110_160_/0.08),transparent_42%)]" />

        {/* Orbital rings — abstract, not a geographic map */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" viewBox="0 0 100 100" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="28"
            fill="none"
            stroke="rgb(56 178 232 / 0.12)"
            strokeWidth="0.15"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx="50"
            cy="50"
            r="22"
            fill="none"
            stroke="rgb(125 211 252 / 0.1)"
            strokeWidth="0.12"
            strokeDasharray="0.4 1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {!reduceMotion ? (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[min(78%,420px)] w-[min(78%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10"
            style={{ background: "conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.06), transparent 40%)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            aria-hidden
          />
        ) : null}

        <svg
          className="absolute inset-0 z-[1] h-full w-full text-primary"
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
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.36"
                strokeDasharray="0.85 2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-primary/22"
                    : "fi-hero-network-line-out text-primary/42 [animation-duration:3.1s]"
                }
              />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.28"
                strokeDasharray="0.5 1.7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-sky-300/12"
                    : "fi-hero-network-line-in text-sky-300/28 [animation-duration:2.4s]"
                }
              />
            </g>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 w-[min(90%,280px)] -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className={cn(
              "rounded-2xl border border-white/[0.12] px-5 py-4 text-center sm:px-6 sm:py-5",
              "bg-[rgb(8_13_22_/0.58)] shadow-[0_0_44px_hsl(var(--primary)/0.18),inset_0_1px_0_rgb(255_255_255_/0.08)] backdrop-blur-md"
            )}
            animate={reduceMotion ? {} : { y: [0, -3, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/88">Intelligence core</p>
            <p className="mt-2 font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Follicle Intelligence Core
            </p>
          </motion.div>
        </div>

        {nodes.map((n) => {
          const StreamIcon = n.Icon;
          return (
            <div
              key={n.label}
              className="absolute z-10 max-w-[40%] sm:max-w-[34%]"
              style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <motion.div
                animate={reduceMotion ? {} : { y: [0, -2, 0] }}
                transition={{
                  duration: 4.2 + n.delay * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: n.delay,
                }}
              >
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-white/[0.1] px-2.5 py-2 sm:px-3 sm:py-2.5",
                    "bg-[rgb(7_11_18_/0.52)] shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-sm"
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <StreamIcon className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <p
                    className={cn(
                      "text-left text-[10px] font-medium leading-snug text-foreground/95 sm:text-[11px]",
                      n.label === "Patient Experience Data" && "text-[9px] sm:text-[10px]"
                    )}
                  >
                    {n.label}
                  </p>
                </div>
              </motion.div>
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(4_7_12_/0.9)] to-transparent" />
      </div>
    </div>
  );
}

const INSIGHT_CARDS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Clinical and biological signal",
    icon: FlaskConical,
    body: "Diagnostic Intelligence (HLI™) and clinic workflows feed Follicle Intelligence—so cohorts sharpen inside one platform without flattening individual nuance.",
  },
  {
    title: "Surgical and imaging fidelity",
    icon: Activity,
    body: "Outcome Intelligence (HairAudit™) anchors technical quality in evidence under the same Follicle Intelligence spine—variance visible before it becomes narrative.",
  },
  {
    title: "Long arcs that define restoration",
    icon: GraduationCap,
    body: "Training Intelligence (IIOHR™) connects standards-led learning to longitudinal outcomes—what happens in the chair linked to what holds years later, inside FI.",
  },
];

export function FiHomeGlobalIntelligenceSection() {
  return (
    <section
      id="global-intelligence-network"
      className="relative scroll-mt-20 border-b border-border/50"
      aria-labelledby="fi-global-intelligence-heading"
    >
      <div className="pointer-events-none absolute inset-0 fi-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.14),transparent_48%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_80%,rgb(90_130_180_/0.09),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[rgb(5_8_14_/0.4)] to-background" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/88">
            Collective intelligence
          </p>
          <h2
            id="fi-global-intelligence-heading"
            className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-[1.12]"
          >
            The network grows inside Follicle Intelligence
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg md:leading-relaxed">
            Every patient journey strengthens the master platform.
          </p>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg md:leading-relaxed">
            As clinics run on Follicle Intelligence, the system continuously learns from:
          </p>
          <ul className="mx-auto mt-5 max-w-xl list-disc space-y-2 pl-5 text-left text-base leading-relaxed text-muted-foreground marker:text-primary/80 md:text-lg md:leading-relaxed">
            <li>Diagnosis patterns</li>
            <li>Treatment response</li>
            <li>Surgical variables</li>
            <li>Imaging analysis</li>
            <li>Long-term patient retention</li>
            <li>Outcome tracking</li>
            <li>Training pathways</li>
          </ul>
        </header>

        <div className="mt-12 md:mt-16">
          <NetworkCoreVisual />
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {INSIGHT_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className={cn(
                  "flex flex-col rounded-2xl border border-white/[0.09] p-6 md:p-7",
                  "bg-[rgb(9_14_22_/0.48)] shadow-[0_18px_56px_rgb(0_0_0_/0.3),inset_0_1px_0_rgb(255_255_255_/0.06)]",
                  "backdrop-blur-xl"
                )}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-foreground">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px] md:leading-relaxed">
                  {card.body}
                </p>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-[1.75rem] border border-white/[0.11] bg-[rgb(8_12_20_/0.52)] p-8 shadow-[0_24px_72px_rgb(0_0_0_/0.38),inset_0_1px_0_rgb(255_255_255_/0.07)] backdrop-blur-xl md:p-10"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,hsl(var(--primary)/0.1),transparent_55%)]" />
          <div className="relative text-center">
            <p className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl md:leading-snug">
              A global structured dataset—owned by the Follicle Intelligence platform, deepened by outcome, diagnostic, and training layers.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
