"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronUp,
  GitCompare,
  LineChart,
  Sparkles,
  X,
} from "lucide-react";

import { generatePatientAiSummaryAction } from "@/lib/actions/patient-ai-summary-actions";
import { cn } from "@/lib/utils";
import type { PatientAiSummaryResult } from "@/src/lib/patients/ai-summary/patientAiSummaryTypes";
import type {
  PatientJourneyPhotoItem,
  PatientJourneyView,
} from "@/src/lib/patients/journey/patientJourneyTypes";

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function CollapsibleSection({
  title,
  eyebrow,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  eyebrow?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/80 shadow-lg shadow-black/25 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-12 items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 sm:px-5"
        aria-expanded={open}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="text-sm font-semibold text-slate-100">
            {title}
            {typeof count === "number" ? (
              <span className="ml-2 text-xs font-normal text-slate-500">({count})</span>
            ) : null}
          </h3>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>
      {open ? <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 sm:px-5">{children}</div> : null}
    </section>
  );
}

function PhotoCompareModal({
  a,
  b,
  onClose,
}: {
  a: PatientJourneyPhotoItem;
  b: PatientJourneyPhotoItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Compare photos"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0B1220] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100">Side-by-side compare</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close compare"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          Visual layout only — not a clinical assessment or progress score.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[a, b].map((p) => (
            <div key={p.id} className="space-y-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {p.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbUrl}
                    alt={`${p.labelDisplay} ${formatDay(p.takenAtIso ?? p.createdAtIso)}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">
                    No preview
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-slate-200">
                {p.labelDisplay} · {formatDay(p.takenAtIso ?? p.createdAtIso)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiCompactBlock({
  tenantId,
  patientId,
}: {
  tenantId: string;
  patientId: string;
}) {
  const [summary, setSummary] = useState<PatientAiSummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => {
    setError(null);
    startTransition(() => {
      void generatePatientAiSummaryAction(tenantId, patientId).then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSummary(res.summary);
      });
    });
  };

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI Summary
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Warm operational overview — never clinical advice.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={load}
          className="inline-flex min-h-10 items-center rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-50"
        >
          {pending ? "Loading…" : summary ? "Refresh summary" : "Load AI Summary"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
      {summary ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm leading-relaxed text-slate-200">{summary.overview}</p>
          {summary.operationalFlags.length > 0 ? (
            <ul className="space-y-1">
              {summary.operationalFlags.slice(0, 3).map((f) => (
                <li key={f.code} className="text-[11px] text-slate-400">
                  · {f.label}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[10px] leading-relaxed text-slate-600">{summary.disclaimer}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Tap load when you want a calm snapshot of visits, media, and open steps.
        </p>
      )}
    </div>
  );
}

/**
 * Enhanced Patient Timeline + Visual Journey.
 * Photos, scale fields, milestones, AI summary compact, quick actions.
 */
export function PatientJourney({
  journey,
  className,
  showAiSummary = true,
}: {
  journey: PatientJourneyView;
  className?: string;
  showAiSummary?: boolean;
}) {
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [comparePair, setComparePair] = useState<
    [PatientJourneyPhotoItem, PatientJourneyPhotoItem] | null
  >(null);

  const photoById = useMemo(() => {
    const m = new Map<string, PatientJourneyPhotoItem>();
    for (const p of journey.photos) m.set(p.id, p);
    return m;
  }, [journey.photos]);

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  };

  const runCompare = () => {
    if (selectedForCompare.length !== 2) return;
    const a = photoById.get(selectedForCompare[0]!);
    const b = photoById.get(selectedForCompare[1]!);
    if (a && b) setComparePair([a, b]);
  };

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="patient-journey"
      aria-label="Patient visual journey"
    >
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/85">
          Visual journey
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-slate-50">
          {journey.displayName
            ? `${journey.displayName.split(/\s+/)[0]}’s journey so far`
            : "Patient journey so far"}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
          Photos, recorded scale fields, and key milestones in one calm place — so you can find your
          footing before the next visit.
        </p>
        <p
          className="rounded-xl border border-amber-400/20 bg-amber-950/25 px-3 py-2 text-[11px] leading-relaxed text-amber-100/85"
          role="note"
        >
          {journey.disclaimer}
        </p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "Photos", v: journey.stats.photoCount },
            { k: "Milestones", v: journey.stats.milestoneCount },
            { k: "Scale fields", v: journey.stats.scaleKindsRecorded },
            { k: "Upcoming", v: journey.stats.upcomingBookings },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">{s.k}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">{s.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {showAiSummary ? (
        <AiCompactBlock tenantId={journey.tenantId} patientId={journey.patientId} />
      ) : null}

      <CollapsibleSection
        title="Photos timeline"
        eyebrow="Media"
        count={journey.photos.length}
        defaultOpen
      >
        {journey.photos.length === 0 ? (
          <p className="text-sm text-slate-400">
            No photos on file yet. When you’re ready, open imaging and attach the views your clinic
            uses — no rush.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-slate-500">
                Select two photos, then compare side-by-side (layout only).
              </p>
              <button
                type="button"
                disabled={selectedForCompare.length !== 2}
                onClick={runCompare}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/25 disabled:opacity-40"
              >
                <GitCompare className="h-3.5 w-3.5" aria-hidden />
                Compare selected
              </button>
            </div>
            <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible md:grid-cols-4">
              {journey.photos.map((p) => {
                const selected = selectedForCompare.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "w-[9.5rem] shrink-0 overflow-hidden rounded-xl border bg-black/20 sm:w-auto",
                      selected ? "border-cyan-400/50 ring-1 ring-cyan-400/30" : "border-white/10"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCompare(p.id)}
                      className="relative block aspect-[4/3] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                      aria-pressed={selected}
                      aria-label={`Select ${p.labelDisplay} photo for compare`}
                    >
                      {p.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] text-slate-500">
                          <Camera className="h-5 w-5 opacity-40" />
                        </span>
                      )}
                    </button>
                    <div className="space-y-1 p-2">
                      <p className="text-[11px] font-medium text-slate-200">{p.labelDisplay}</p>
                      <p className="text-[10px] tabular-nums text-slate-500">
                        {formatDay(p.takenAtIso ?? p.createdAtIso)}
                      </p>
                      <Link
                        href={p.href}
                        className="inline-flex min-h-9 items-center text-[10px] font-medium text-cyan-300 hover:text-cyan-200"
                      >
                        Open imaging →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Scale history"
        eyebrow="Recorded fields"
        count={journey.scaleSeries.length}
        defaultOpen
      >
        {journey.scaleSeries.length === 0 ? (
          <p className="text-sm text-slate-400">
            No scale fields on file yet. When forms capture Norwood, Ludwig, or clinic scale values,
            they’ll show here as recorded — not interpreted.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {journey.scaleSeries.map((s) => (
              <div
                key={s.kind}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                      <LineChart className="h-3.5 w-3.5 text-cyan-400/80" aria-hidden />
                      {s.kindLabel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{s.trendLabel}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      s.trend === "up"
                        ? "bg-amber-500/15 text-amber-100"
                        : s.trend === "down"
                          ? "bg-emerald-500/15 text-emerald-100"
                          : "bg-white/5 text-slate-400"
                    )}
                  >
                    {s.trend}
                  </span>
                </div>
                {/* Simple bar chart from ordinal ranks when numeric */}
                <ul className="mt-3 space-y-2">
                  {s.points.map((pt, i) => (
                    <li key={`${pt.value}-${i}`} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-200">{pt.value}</span>
                        <span className="tabular-nums text-slate-500">
                          {formatDay(pt.recordedAtIso)}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-400/50"
                          style={{
                            width: `${Math.min(100, 20 + ((i + 1) / s.points.length) * 80)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Key milestones"
        eyebrow="Events"
        count={journey.milestones.length}
        defaultOpen
      >
        {journey.milestones.length === 0 ? (
          <p className="text-sm text-slate-400">
            Milestones appear as bookings, cases, imaging, and enquiries land on this record.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-white/10 pl-4">
            {journey.milestones.map((m) => (
              <li key={m.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#0F1629]",
                    m.severity === "success"
                      ? "bg-emerald-400"
                      : m.severity === "attention"
                        ? "bg-amber-400"
                        : "bg-cyan-400"
                  )}
                  aria-hidden
                />
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {m.kindLabel}
                    </span>
                    <time className="text-[10px] tabular-nums text-slate-500" dateTime={m.occurredAtIso}>
                      {formatDay(m.occurredAtIso)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-100">{m.title}</p>
                  {m.subtitle ? (
                    <p className="mt-0.5 text-xs text-slate-500">{m.subtitle}</p>
                  ) : null}
                  {m.href ? (
                    <Link
                      href={m.href}
                      className="mt-1.5 inline-flex min-h-9 items-center text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Open →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Quick actions" eyebrow="Next steps" defaultOpen>
        <ul className="grid gap-2 sm:grid-cols-2">
          {journey.quickActions.map((a) => (
            <li key={a.code}>
              <Link
                href={a.href}
                className="flex min-h-14 flex-col justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2.5 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              >
                <span className="text-sm font-semibold text-cyan-50">{a.label}</span>
                <span className="text-[11px] leading-snug text-cyan-100/70">{a.description}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 text-[10px] text-slate-600">
          <Calendar className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Operational navigation only — the journey never books treatment or interprets findings.
        </p>
      </CollapsibleSection>

      {comparePair ? (
        <PhotoCompareModal
          a={comparePair[0]}
          b={comparePair[1]}
          onClose={() => setComparePair(null)}
        />
      ) : null}
    </div>
  );
}

/** Server-friendly wrapper: build journey client display from prebuilt view. */
export function PatientJourneyFromView(props: {
  journey: PatientJourneyView;
  className?: string;
}) {
  return <PatientJourney journey={props.journey} className={props.className} />;
}
