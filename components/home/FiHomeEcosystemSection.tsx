"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Camera,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Megaphone,
  Users,
} from "lucide-react";
import { Fragment, useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const MODULES = [
  "LeadFlow",
  "ClinicOS",
  "PatientOS",
  "ConsultationOS",
  "ImagingOS",
  "SurgeryOS",
  "AuditOS",
  "AcademyOS",
  "AnalyticsOS",
] as const;

function polarToPct(index: number, total: number, radiusPct: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return { x: 50 + radiusPct * Math.cos(angle), y: 50 + radiusPct * Math.sin(angle) };
}

function EcosystemNetworkDiagram() {
  const reduceMotion = useReducedMotion();
  const nodes = useMemo(() => {
    const r = 36;
    return MODULES.map((label, i) => ({
      label,
      ...polarToPct(i, MODULES.length, r),
      delay: i * 0.1,
    }));
  }, []);

  return (
    <div
      className="relative mx-auto w-full max-w-5xl"
      role="img"
      aria-label="Diagram: Follicle Intelligence core connected to nine operating systems—LeadFlow, ClinicOS, PatientOS, ConsultationOS, ImagingOS, SurgeryOS, AuditOS, AcademyOS, and AnalyticsOS—with animated data flows."
    >
      <div
        className={cn(
          "relative aspect-[16/11] min-h-[280px] w-full overflow-hidden rounded-[1.85rem] border border-white/[0.09]",
          "bg-gradient-to-br from-[rgb(11_17_27_/0.95)] via-[rgb(7_11_18_/0.92)] to-[rgb(5_8_14_/0.98)]",
          "shadow-[0_28px_90px_rgb(0_0_0_/0.5),inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-xl",
          "sm:min-h-[340px] md:aspect-[16/9] md:min-h-[380px] lg:min-h-[420px]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,hsl(var(--primary)/0.16),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgb(80_120_180_/0.07),transparent_45%)]" />

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
                stroke="rgb(56 178 232 / 0.12)"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.38"
                strokeDasharray="0.85 2.1"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-primary/22"
                    : "fi-hero-network-line-out text-primary/48 [animation-duration:3.2s]"
                }
              />
              <line
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="currentColor"
                strokeWidth="0.3"
                strokeDasharray="0.5 1.7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-sky-300/12"
                    : "fi-hero-network-line-in text-sky-300/32 [animation-duration:2.5s]"
                }
              />
            </g>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className={cn(
              "w-[min(92vw,280px)] rounded-2xl border border-white/[0.12] px-5 py-4 text-center sm:w-[min(90%,300px)] sm:px-6 sm:py-5",
              "bg-[rgb(9_14_22_/0.55)] shadow-[0_0_48px_hsl(var(--primary)/0.2),inset_0_1px_0_rgb(255_255_255_/0.08)] backdrop-blur-md"
            )}
            animate={reduceMotion ? {} : { y: [0, -4, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/88">Intelligence core</p>
            <p className="mt-2 font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Follicle Intelligence
            </p>
          </motion.div>
        </div>

        {nodes.map((n) => (
          <div
            key={n.label}
            className="absolute z-10 max-w-[32%] sm:max-w-[28%] md:max-w-[24%]"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -2.5, 0] }}
              transition={{
                duration: 4 + n.delay * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: n.delay,
              }}
            >
              <div
                className={cn(
                  "rounded-xl border border-white/[0.1] px-2.5 py-2 text-center sm:px-3 sm:py-2.5",
                  "bg-[rgb(7_11_18_/0.52)] shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-sm"
                )}
              >
                <p className="text-[10px] font-medium leading-tight text-foreground/94 sm:text-[11px] md:text-xs">
                  {n.label}
                </p>
              </div>
            </motion.div>
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[rgb(4_7_12_/0.9)] to-transparent" />
      </div>
    </div>
  );
}

const PLATFORM_CARDS: {
  name: string;
  intelligence: string;
  icon: LucideIcon;
  description: string;
  href: string;
  external?: boolean;
}[] = [
  {
    name: "LeadFlow",
    intelligence: "Acquisition layer",
    icon: Megaphone,
    description: "CRM, patient acquisition, follow-up automation.",
    href: "/platform",
  },
  {
    name: "ClinicOS",
    intelligence: "Operations layer",
    icon: Building2,
    description: "Scheduling, operations, staff calendars, clinic workflow.",
    href: "/platform",
  },
  {
    name: "PatientOS",
    intelligence: "Patient record layer",
    icon: Users,
    description: "Unified patient records and Patient Twin.",
    href: "/hair-intelligence",
  },
  {
    name: "ConsultationOS",
    intelligence: "Clinical decision layer",
    icon: ClipboardList,
    description: "Assessments, treatment planning, pathology, recommendations.",
    href: "/hair-intelligence",
  },
  {
    name: "ImagingOS",
    intelligence: "Imaging layer",
    icon: Camera,
    description: "Clinical photography, scalp mapping, AI image classification.",
    href: "/platform",
  },
  {
    name: "SurgeryOS",
    intelligence: "Procedure layer",
    icon: Activity,
    description: "Surgical planning, graft tracking, procedure workflows.",
    href: "/solutions",
  },
  {
    name: "AuditOS",
    intelligence: "Quality layer",
    icon: ClipboardCheck,
    description: "Outcome measurement and quality intelligence.",
    href: "/methodology",
  },
  {
    name: "AcademyOS",
    intelligence: "Competency layer",
    icon: GraduationCap,
    description: "Training, certification, competencies.",
    href: "/methodology",
  },
  {
    name: "AnalyticsOS",
    intelligence: "Performance layer",
    icon: BarChart3,
    description: "Revenue, conversion, performance intelligence.",
    href: "/dashboard-demo",
  },
];

function PatientJourneyFlow() {
  const reduceMotion = useReducedMotion();
  const gradId = useId().replace(/:/g, "");
  const stages = [
    "Enquiry",
    "Consultation",
    "Treatment",
    "Surgery",
    "Outcome",
    "Education",
    "Analytics",
  ] as const;

  const w = 720;
  const h = 200;
  const hubY = 36;
  const baseY = 168;
  const hubX = w / 2;
  const spacing = w / (stages.length + 1);

  const paths = stages.map((_, i) => {
    const x = spacing * (i + 1);
    const mx = hubX + (x - hubX) * 0.35;
    return `M ${x} ${baseY} Q ${mx} ${baseY - 52} ${hubX} ${hubY}`;
  });

  return (
    <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[rgb(8_12_20_/0.45)] p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-xl sm:p-8 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.12),transparent_50%)]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-[1.65rem] md:leading-snug">
          Individually Powerful. Collectively Transformational.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Each patient touchpoint emits structured signal into Follicle Intelligence—the receiving layer where those
          streams fuse—so cohorts sharpen, governance holds, and improvement compounds across every enterprise deployment.
        </p>
      </div>

      <div className="relative mx-auto mt-10 max-w-[720px]">
        <motion.div
          className="mx-auto flex max-w-md justify-center rounded-2xl border border-white/[0.1] bg-[rgb(10_15_24_/0.65)] px-5 py-3 text-center shadow-[0_0_36px_hsl(var(--primary)/0.12)] backdrop-blur-md sm:max-w-lg"
          animate={reduceMotion ? {} : { opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/85">Receiving layer</p>
            <p className="mt-1 font-display text-sm font-semibold text-foreground sm:text-base">Follicle Intelligence</p>
          </div>
        </motion.div>

        <svg
          className="mx-auto mt-1 hidden w-full max-w-[720px] text-primary lg:block"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgb(56 178 232)" stopOpacity="0.05" />
              <stop offset="55%" stopColor="rgb(56 178 232)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(125 211 252)" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {paths.map((d, i) => (
            <g key={stages[i]}>
              <path
                d={d}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth="2.2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeDasharray="4 10"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  reduceMotion
                    ? "text-primary/20"
                    : cn("text-primary/40", "fi-hero-network-line-out [animation-duration:3.8s]")
                }
              />
            </g>
          ))}
        </svg>

        <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {stages.map((label, i) => (
            <Fragment key={label}>
              <div className="flex shrink-0 flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(6_10_16_/0.55)] px-3 py-2.5 text-center backdrop-blur-sm">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-1 text-[11px] font-medium text-foreground">{label}</span>
              </div>
              {i < stages.length - 1 ? (
                <span className="flex shrink-0 items-center text-muted-foreground/60" aria-hidden>
                  →
                </span>
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="relative -mt-1 hidden gap-1.5 lg:-mt-12 lg:grid lg:grid-cols-7">
          {stages.map((label, i) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(6_10_16_/0.55)] px-1.5 py-2.5 text-center backdrop-blur-sm"
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Stage {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-1.5 text-[11px] font-medium leading-snug text-foreground md:text-xs">{label}</span>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Signal from each stage is normalized, permissioned, and written back to the intelligence core—strengthening
          models, benchmarks, and governance for every connected platform.
        </p>
      </div>
    </div>
  );
}

export function FiHomeEcosystemSection() {
  return (
    <section
      id="ecosystem"
      className="fi-grid relative scroll-mt-20 border-b border-border/50"
      aria-labelledby="fi-home-ecosystem-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.14),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[rgb(5_8_14_/0.35)] to-background/90" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/88">Platform</p>
          <h2
            id="fi-home-ecosystem-heading"
            className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-[1.12]"
          >
            One Platform. Nine Operating Systems.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg md:leading-relaxed">
            Everything a modern hair restoration clinic needs on the Follicle Intelligence platform—connected from
            enquiry to long-term outcome.
          </p>
        </header>

        <div className="mt-12 md:mt-16">
          <EcosystemNetworkDiagram />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {PLATFORM_CARDS.map((card) => {
            const Icon = card.icon;
            const linkProps = card.external
              ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
              : {};

            return (
              <div
                key={card.name}
                className={cn(
                  "group flex flex-col rounded-2xl border border-white/[0.09] p-6",
                  "bg-[rgb(9_14_22_/0.42)] shadow-[0_16px_48px_rgb(0_0_0_/0.28),inset_0_1px_0_rgb(255_255_255_/0.06)]",
                  "backdrop-blur-xl transition-[border-color,box-shadow] duration-300",
                  "hover:border-primary/25 hover:shadow-[0_20px_56px_rgb(0_0_0_/0.35),0_0_0_1px_hsl(var(--primary)/0.12)]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl border border-white/[0.1] bg-[rgb(12_18_28_/0.6)] p-2.5 text-primary shadow-inner">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/85">
                  {card.intelligence}
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground">{card.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                <Link
                  href={card.href}
                  {...linkProps}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/85"
                >
                  Learn more
                  <ArrowRight className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>

        <PatientJourneyFlow />
      </div>
    </section>
  );
}
