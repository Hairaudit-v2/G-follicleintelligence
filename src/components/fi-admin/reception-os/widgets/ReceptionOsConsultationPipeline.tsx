import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import {
  RECEPTION_OS_PIPELINE_COLUMN_IDS,
  RECEPTION_OS_PIPELINE_COLUMN_LABELS,
  type ReceptionOsPipelineColumnId,
} from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsPipelineCard } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

const COLUMN_TONES: Record<ReceptionOsPipelineColumnId, string> = {
  new_lead: "border-slate-500/25 bg-slate-500/[0.06]",
  consultation_booked: "border-sky-500/25 bg-sky-500/[0.06]",
  consultation_completed: "border-indigo-500/25 bg-indigo-500/[0.06]",
  quote_sent: "border-amber-500/25 bg-amber-500/[0.06]",
  deposit_pending: "border-orange-500/30 bg-orange-500/[0.08]",
  surgery_booked: "border-emerald-500/30 bg-emerald-500/[0.08]",
};

function PipelineCard({ card }: { card: ReceptionOsPipelineCard }) {
  const href = receptionOsPrimaryHref(card.hrefs);
  const inner = (
    <article className="rounded-lg border border-white/[0.06] bg-[#0a101f]/90 p-2.5 text-sm shadow-sm shadow-black/25">
      <p className="truncate font-semibold text-slate-50">{card.patientOrLeadLabel}</p>
      {card.detailLine ? (
        <p className="mt-1 line-clamp-2 text-[0.68rem] leading-snug text-slate-500">
          {card.detailLine}
        </p>
      ) : null}
      <ReceptionOsRecordLinks hrefs={card.hrefs} className="mt-1.5" />
    </article>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="block transition hover:opacity-90">
      {inner}
    </Link>
  );
}

export function ReceptionOsConsultationPipelineWidget(props: {
  columns: Record<ReceptionOsPipelineColumnId, ReceptionOsPipelineCard[]>;
  counts: Record<ReceptionOsPipelineColumnId, number>;
}) {
  const { columns, counts } = props;

  return (
    <DashboardCard className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Consultation pipeline"
          description="Lead → surgery conversion funnel"
        />
      </div>
      <div className="overflow-x-auto p-3">
        <div className="flex min-w-[960px] gap-3">
          {RECEPTION_OS_PIPELINE_COLUMN_IDS.map((colId) => (
            <div
              key={colId}
              className={cn(
                "flex min-w-[150px] flex-1 flex-col rounded-xl border p-2",
                COLUMN_TONES[colId]
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {RECEPTION_OS_PIPELINE_COLUMN_LABELS[colId]}
                </p>
                <span className="rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs tabular-nums text-slate-300">
                  {counts[colId]}
                </span>
              </div>
              <div className="max-h-[220px] space-y-2 overflow-y-auto">
                {(columns[colId] ?? []).slice(0, 8).map((card) => (
                  <PipelineCard key={card.id} card={card} />
                ))}
                {(columns[colId] ?? []).length === 0 ? (
                  <p className="px-1 py-4 text-center text-[0.65rem] text-slate-600">Empty</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
