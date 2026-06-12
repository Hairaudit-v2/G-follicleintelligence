"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Camera,
  ClipboardList,
  Droplets,
  GraduationCap,
  HeartPulse,
  LineChart,
  Pill,
  RefreshCw,
  Ruler,
  Smile,
  Stethoscope,
  Syringe,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const DATA_KEYS = [
  "clinicalImaging",
  "hairLossProgression",
  "bloodMarkers",
  "medications",
  "treatmentHistory",
  "prpExosomes",
  "surgeryHistory",
  "followUpProgression",
  "outcomeMeasurements",
  "patientSatisfaction",
] as const;

type DataKey = (typeof DATA_KEYS)[number];

const DATA_META: Record<DataKey, { label: string; Icon: LucideIcon }> = {
  clinicalImaging: { label: "Clinical imaging", Icon: Camera },
  hairLossProgression: { label: "Hair loss progression", Icon: LineChart },
  bloodMarkers: { label: "Blood markers", Icon: Droplets },
  medications: { label: "Medications", Icon: Pill },
  treatmentHistory: { label: "Treatment history", Icon: ClipboardList },
  prpExosomes: { label: "PRP and exosomes", Icon: Syringe },
  surgeryHistory: { label: "Surgery history", Icon: Activity },
  followUpProgression: { label: "Follow-up progression", Icon: RefreshCw },
  outcomeMeasurements: { label: "Outcome measurements", Icon: Ruler },
  patientSatisfaction: { label: "Patient satisfaction", Icon: Smile },
};

const TIMELINE: { title: string; points: DataKey[] }[] = [
  {
    title: "Consultation",
    points: ["clinicalImaging", "hairLossProgression", "patientSatisfaction"],
  },
  { title: "Hair Loss Assessment", points: ["clinicalImaging", "hairLossProgression"] },
  { title: "Blood Analysis", points: ["bloodMarkers"] },
  {
    title: "Treatment Plan",
    points: ["medications", "clinicalImaging", "treatmentHistory"],
  },
  {
    title: "PRP / Exosomes",
    points: ["prpExosomes", "medications", "clinicalImaging"],
  },
  {
    title: "Hair Transplant",
    points: ["surgeryHistory", "clinicalImaging", "outcomeMeasurements"],
  },
  {
    title: "6 Month Review",
    points: [
      "clinicalImaging",
      "followUpProgression",
      "outcomeMeasurements",
      "patientSatisfaction",
    ],
  },
  {
    title: "12 Month Outcome",
    points: [
      "clinicalImaging",
      "outcomeMeasurements",
      "hairLossProgression",
      "patientSatisfaction",
    ],
  },
  {
    title: "Lifetime Monitoring",
    points: [
      "clinicalImaging",
      "bloodMarkers",
      "medications",
      "treatmentHistory",
      "prpExosomes",
      "surgeryHistory",
      "followUpProgression",
      "outcomeMeasurements",
      "hairLossProgression",
      "patientSatisfaction",
    ],
  },
];

const INTELLIGENCE_CARDS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Clinical Intelligence",
    icon: Stethoscope,
    body: "Imaging, labs, meds, and every documented decision stay attached to one identity—so today’s work is always comparable to yesterday’s baseline.",
  },
  {
    title: "Surgical Intelligence",
    icon: Activity,
    body: "Transplant episodes, regenerative protocols, and procedural detail live beside the same imaging spine—audit-ready history, not scattered files.",
  },
  {
    title: "Outcome Intelligence",
    icon: HeartPulse,
    body: "Follow-up cadence, objective measures, and patient-reported signal stack into trajectories you can defend, refine, and learn from over time.",
  },
  {
    title: "Training Intelligence",
    icon: GraduationCap,
    body: "Rich twins show how standards behave in the real world—powering teaching, review, and safer defaults grounded in longitudinal behaviour.",
  },
  {
    title: "Business Intelligence",
    icon: BarChart3,
    body: "Operations and growth inherit one longitudinal spine—clean cohorts and continuity without stitching together duplicate patient records.",
  },
];

function DataSpine({ active }: { active: Set<DataKey> }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1 sm:justify-start">
      {DATA_KEYS.map((key) => {
        const on = active.has(key);
        const { Icon, label } = DATA_META[key];
        return (
          <span
            key={key}
            title={label}
            className={cn(
              "inline-flex max-w-full items-center gap-0.5 rounded-full border px-1 py-0.5 text-[7px] font-medium uppercase leading-none tracking-wide sm:gap-1 sm:px-1.5 sm:text-[8px]",
              on
                ? "border-primary/35 bg-primary/12 text-primary/95 shadow-[0_0_10px_hsl(var(--primary)/0.1)]"
                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground/35"
            )}
          >
            <Icon className="h-2 w-2 shrink-0 opacity-90 sm:h-2.5 sm:w-2.5" aria-hidden />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function PatientTwinTimeline() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mt-12 md:mt-16">
      <div
        className="pointer-events-none absolute left-0 right-0 top-[2.25rem] hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent md:block"
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute left-0 top-[2.25rem] hidden h-0.5 w-full overflow-hidden md:block"
        initial={false}
        animate={reduceMotion ? {} : { opacity: [0.4, 0.85, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <motion.div
          className="h-full w-[28%] bg-gradient-to-r from-transparent via-primary/55 to-transparent"
          animate={reduceMotion ? {} : { x: ["-20%", "120%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-9 [&::-webkit-scrollbar]:hidden">
        {TIMELINE.map((m, i) => {
          const active = new Set(m.points);
          return (
            <motion.article
              key={m.title}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.35) }}
              className={cn(
                "relative flex min-w-[200px] shrink-0 flex-col rounded-2xl border border-white/[0.09] p-4",
                "bg-[rgb(8_12_20_/0.5)] shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-md md:min-w-0"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-foreground">{m.title}</h3>
              </div>
              <DataSpine active={active} />
              {i < TIMELINE.length - 1 ? (
                <div
                  className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-primary/30 to-transparent xl:block"
                  aria-hidden
                />
              ) : null}
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function GrowthCascade() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-14 space-y-10 md:mt-16">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.1] bg-[rgb(7_11_18_/0.55)] p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-xl sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="relative flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex flex-1 flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(10_15_24_/0.55)] px-4 py-4 text-center sm:py-5">
            <motion.span
              className="font-display text-2xl font-semibold tabular-nums text-primary sm:text-3xl"
              animate={reduceMotion ? {} : { opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              1
            </motion.span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Patient Twin
            </span>
          </div>
          <span className="py-1 text-center text-lg text-primary/50 sm:hidden" aria-hidden>
            ↓
          </span>
          <span className="hidden shrink-0 text-center text-lg text-primary/50 sm:block" aria-hidden>
            →
          </span>
          <div className="flex flex-1 flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(10_15_24_/0.55)] px-4 py-4 text-center sm:py-5">
            <span className="font-display text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">10</span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Data sources
            </span>
          </div>
          <span className="py-1 text-center text-lg text-primary/50 sm:hidden" aria-hidden>
            ↓
          </span>
          <span className="hidden shrink-0 text-center text-lg text-primary/50 sm:block" aria-hidden>
            →
          </span>
          <div className="flex flex-1 flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(10_15_24_/0.55)] px-4 py-4 text-center sm:py-5">
            <span className="font-display text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">1,000</span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Structured data points
            </span>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-center sm:hidden" aria-hidden>
        <span className="text-xl text-primary/45">↓</span>
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, delay: 0.08 }}
        className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.1] bg-[rgb(7_11_18_/0.55)] p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/0.06)] backdrop-blur-xl sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,hsl(var(--primary)/0.08),transparent_50%)]" />
        <div className="relative flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex flex-1 flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(10_15_24_/0.55)] px-4 py-4 text-center sm:py-5">
            <span className="font-display text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">100,000</span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Patient Twins
            </span>
          </div>
          <span className="py-1 text-center text-lg text-primary/50 sm:hidden" aria-hidden>
            ↓
          </span>
          <span className="hidden shrink-0 text-center text-lg text-primary/50 sm:block" aria-hidden>
            →
          </span>
          <div className="flex flex-[1.4] flex-col items-center rounded-xl border border-white/[0.08] bg-[rgb(10_15_24_/0.55)] px-4 py-4 text-center sm:py-5">
            <span className="font-display text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">100+</span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Million structured data points
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="relative flex flex-col items-center gap-4 pt-2"
      >
        <span className="text-2xl text-primary/60" aria-hidden>
          →
        </span>
        <div className="w-full max-w-2xl rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-[rgb(10_16_26_/0.7)] to-[rgb(6_10_16_/0.85)] px-6 py-6 text-center shadow-[0_0_48px_hsl(var(--primary)/0.15)] backdrop-blur-md sm:px-10 sm:py-8">
          <p className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Global clinical intelligence at patient scale
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Scale compounds: enough structured twins make cohort effects visible—patterns that no single clinic could
            surface alone, yet each deployment stays permissioned and governable under tenant policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function FiHomePatientTwinSection() {
  return (
    <section
      id="patient-twin"
      className="relative scroll-mt-20 border-b border-border/50"
      aria-labelledby="fi-patient-twin-heading"
    >
      <div className="pointer-events-none absolute inset-0 fi-grid opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,hsl(var(--primary)/0.12),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_60%,rgb(100_140_190_/0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/88">The Patient Twin™</p>
          <h2
            id="fi-patient-twin-heading"
            className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-[1.12]"
          >
            Meet The Patient Twin™
          </h2>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground md:text-lg md:leading-relaxed">
            <p>Every patient becomes a living intelligence record.</p>
            <p>One patient.</p>
            <p>One timeline.</p>
            <p>Connected forever.</p>
          </div>
        </header>

        <PatientTwinTimeline />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {INTELLIGENCE_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={cn(
                  "flex flex-col rounded-2xl border border-white/[0.08] p-5",
                  "bg-[rgb(9_14_22_/0.45)] shadow-[inset_0_1px_0_rgb(255_255_255_/0.05)] backdrop-blur-lg lg:min-h-[200px]"
                )}
              >
                <div className="rounded-lg border border-white/[0.08] bg-primary/8 p-2 text-primary w-fit">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-sm font-semibold tracking-tight text-foreground">{card.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px] sm:leading-relaxed">
                  {card.body}
                </p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto mt-14 max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[rgb(8_12_20_/0.55)] p-8 shadow-[0_24px_70px_rgb(0_0_0_/0.35),inset_0_1px_0_rgb(255_255_255_/0.07)] backdrop-blur-xl md:p-10"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.14),transparent_55%)]" />
          <div className="relative text-center">
            <p className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Every patient interaction improves future clinical decision making.
            </p>
          </div>
        </motion.div>

        <GrowthCascade />
      </div>
    </section>
  );
}
