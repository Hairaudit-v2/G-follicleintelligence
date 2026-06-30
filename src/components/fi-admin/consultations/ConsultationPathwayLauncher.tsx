"use client";

import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiSection } from "@/src/components/fi-design/FiSection";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import {
  consultationPathwayCtaLabel,
  type ConsultationPathwayCardView,
  type ConsultationPathwayLauncherViewModel,
  type ConsultationPathwayProgressLabel,
} from "@/src/lib/consultations/consultationPathwayLauncherModel";

function progressTone(p: ConsultationPathwayProgressLabel): "neutral" | "info" | "success" {
  if (p === "not_started") return "neutral";
  if (p === "in_progress") return "info";
  return "success";
}

function progressLabel(p: ConsultationPathwayProgressLabel): string {
  if (p === "not_started") return "Not started";
  if (p === "in_progress") return "In progress";
  return "Submitted";
}

function PathwayCard({ card }: { card: ConsultationPathwayCardView }) {
  const isSoon = card.availability === "soon";
  const cta = consultationPathwayCtaLabel(card.progress);
  const href = card.href?.trim() || null;

  return (
    <div
      className={`flex flex-col rounded-xl border p-4 shadow-lg shadow-black/40 ${
        card.recommended
          ? "border-sky-300/80 bg-cyan-500/10 ring-1 ring-sky-200/60 dark:border-sky-600/40 dark:bg-sky-950/30 dark:ring-sky-800/50"
          : "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-slate-100 dark:text-slate-50">{card.title}</h3>
          {card.recommended ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300 dark:text-sky-300">
              Recommended pathway
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isSoon ? (
            <FiStatusBadge tone="neutral" appearance="pill">
              Coming soon
            </FiStatusBadge>
          ) : (
            <FiStatusBadge tone={progressTone(card.progress)} appearance="pill">
              {progressLabel(card.progress)}
            </FiStatusBadge>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-snug text-slate-300 dark:text-slate-300">{card.purpose}</p>
      <p className="mt-2 text-xs leading-snug text-slate-400 dark:text-slate-400">
        <span className="font-semibold text-slate-300 dark:text-slate-300">When to use: </span>
        {card.whenToUse}
      </p>
      {!isSoon && card.templateSlug ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {card.instanceId
            ? "A saved ConsultationOS pathway instance exists for this visit."
            : "No pathway instance yet - starting opens the guided form for this template."}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isSoon && href ? (
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-black/40 transition hover:bg-slate-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-[#0F1629]/80 backdrop-blur-md"
          >
            {cta}
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
            Unavailable
          </span>
        )}
      </div>
    </div>
  );
}

const DEFAULT_PATHWAY_TITLE = "Pathway selection";
const DEFAULT_PATHWAY_DESCRIPTION =
  "Structured guided pathways for this visit. Clinical capture happens inside each form — pick a card to continue or switch pathways.";

export function ConsultationPathwayLauncher({
  model,
  sectionTitle = DEFAULT_PATHWAY_TITLE,
  sectionDescription = DEFAULT_PATHWAY_DESCRIPTION,
  cardClassName,
}: {
  model: ConsultationPathwayLauncherViewModel;
  /** Override section title (e.g. post-completion “review another pathway”). */
  sectionTitle?: string;
  sectionDescription?: string;
  /** Extra classes on outer card (e.g. hero emphasis on hub). */
  cardClassName?: string;
}) {
  return (
    <div id="consultation-pathway-launcher">
      <FiCard className={`space-y-4 ${cardClassName ?? ""}`.trim()}>
        <FiSection
          title={sectionTitle}
          description={sectionDescription}
          headingId="consultation-pathway-launcher-heading"
        >
          <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-400">
            Direct links:{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] dark:bg-slate-800">
              /forms
            </code>
            ,{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] dark:bg-slate-800">
              /forms/hair-loss-treatment
            </code>
            ,{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] dark:bg-slate-800">
              /forms/female-hair-loss
            </code>
            ,{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] dark:bg-slate-800">
              /forms/repair
            </code>
            ,{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] dark:bg-slate-800">
              /forms/follow-up
            </code>
            ,{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] dark:bg-slate-800">
              /forms/pathology
            </code>
            .
          </p>
          {model.recommendedHint?.trim() ? (
            <div
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2.5 text-sm text-cyan-200 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-50"
              role="status"
            >
              <strong className="font-semibold">Hint: </strong>
              {model.recommendedHint}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {model.cards.map((c) => (
              <PathwayCard key={c.pathKey} card={c} />
            ))}
          </div>
        </FiSection>
      </FiCard>
    </div>
  );
}
