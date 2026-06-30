import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { ClinicSnapshotCard } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";

export function ClinicSnapshotCards(props: { cards: readonly ClinicSnapshotCard[] }) {
  const { cards } = props;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="clinic-snapshot-heading">
      <SectionHeader
        id="clinic-snapshot-heading"
        kicker="Live snapshot"
        title="Clinic today"
        description="The highest-value operational signals for right now."
      />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className={cn(
              "flex min-h-[7.5rem] flex-col justify-between rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-4 py-4 shadow-inner shadow-black/20 backdrop-blur-sm transition",
              "hover:border-cyan-500/25 hover:bg-[#141c33]/80"
            )}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-50">
              {card.value}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{card.detail}</p>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
