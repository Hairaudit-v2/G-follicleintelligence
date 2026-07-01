import Link from "next/link";
import { Layers, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import type {
  GraftIntelligenceSnapshot,
  SurgeryOsGraftSummary,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          accent ? "text-cyan-300" : "text-slate-100"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function reconciliationTone(status: SurgeryOsGraftSummary["reconciliationStatus"]): string {
  switch (status) {
    case "balanced":
    case "completed":
      return "text-emerald-400";
    case "mismatch":
      return "text-rose-400";
    default:
      return "text-amber-400";
  }
}

function GraftIntelligenceCard({
  intelligence,
  graftSummary,
}: {
  intelligence: GraftIntelligenceSnapshot;
  graftSummary?: SurgeryOsGraftSummary;
}) {
  const href =
    graftSummary?.hrefs.surgery ?? graftSummary?.hrefs.case ?? graftSummary?.hrefs.patient ?? null;
  const actionableWarnings = intelligence.warnings.filter((w) => w.kind !== "no_data");

  const inner = (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{intelligence.patientLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">{intelligence.summary}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Reconciliation</p>
          <p
            className={cn(
              "text-xs font-semibold",
              reconciliationTone(intelligence.reconciliationStatus)
            )}
          >
            {SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS[intelligence.reconciliationStatus]}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Confidence {intelligence.graftCountConfidence}%
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCell label="Total grafts" value={intelligence.totalGrafts} accent />
        <StatCell label="Total hairs" value={intelligence.totalHairs} accent />
        <StatCell
          label="Avg hairs/graft"
          value={
            intelligence.averageHairsPerGraft != null
              ? intelligence.averageHairsPerGraft.toFixed(2)
              : "—"
          }
        />
        <StatCell
          label="Extraction"
          value={
            intelligence.extractionProgressPercent != null
              ? `${intelligence.extractionProgressPercent}%`
              : "—"
          }
        />
        <StatCell
          label="Implantation"
          value={
            intelligence.implantationProgressPercent != null
              ? `${intelligence.implantationProgressPercent}%`
              : "—"
          }
        />
        <StatCell label="Multi-hair" value={intelligence.multiHairGrafts} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCell label="Singles" value={intelligence.singles} />
        <StatCell label="Doubles" value={intelligence.doubles} />
        <StatCell label="Triples" value={intelligence.triples} />
        <StatCell label="Multiples" value={intelligence.multiples} />
      </div>

      {graftSummary ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCell label="Target" value={graftSummary.targetGrafts ?? "—"} />
          <StatCell label="Extracted" value={graftSummary.extractedGrafts} />
          <StatCell label="Implanted" value={graftSummary.implantedGrafts} />
          <StatCell label="Remaining" value={graftSummary.remainingGrafts} />
          <StatCell label="Discarded" value={graftSummary.discardedGrafts} />
          <StatCell
            label="Phase"
            value={graftSummary.phaseLabel}
          />
        </div>
      ) : null}

      {actionableWarnings.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {actionableWarnings.map((warning) => (
            <li
              key={`${warning.kind}:${warning.message}`}
              className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <p className="text-xs text-slate-300">{warning.message}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-95">
        {inner}
      </Link>
    );
  }

  return inner;
}

export function SurgeryOsGraftIntelligenceWidget({
  graftSummary,
  graftIntelligence = [],
}: {
  graftSummary: SurgeryOsGraftSummary[];
  graftIntelligence?: GraftIntelligenceSnapshot[];
}) {
  const summaryBySurgery = new Map(graftSummary.map((g) => [g.surgeryId, g]));
  const rows =
    graftIntelligence.length > 0
      ? graftIntelligence
      : graftSummary.map((g) => ({
          surgeryId: g.surgeryId,
          patientLabel: g.patientLabel,
          totalGrafts: g.extractedGrafts,
          totalHairs: g.totalHairs,
          averageHairsPerGraft: g.averageHairsPerGraft,
          singles: g.singles,
          doubles: g.doubles,
          triples: g.triples,
          multiples: g.multiples,
          multiHairGrafts: g.doubles + g.triples + g.multiples,
          graftCountConfidence: 0,
          reconciliationStatus: g.reconciliationStatus,
          extractionProgressPercent: g.progressPercent,
          implantationProgressPercent: null,
          summary:
            g.extractedGrafts > 0
              ? `${g.patientLabel} — ${g.extractedGrafts} grafts tracked.`
              : "No graft intelligence available yet.",
          warnings: [],
        }));

  return (
    <DashboardCard className="flex h-full min-h-[360px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Live graft intelligence"
          description={`${rows.length} surgery session(s) · extraction, implantation & reconciliation`}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Layers className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">No graft intelligence available yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((intelligence) => (
              <li key={intelligence.surgeryId}>
                <GraftIntelligenceCard
                  intelligence={intelligence}
                  graftSummary={summaryBySurgery.get(intelligence.surgeryId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
