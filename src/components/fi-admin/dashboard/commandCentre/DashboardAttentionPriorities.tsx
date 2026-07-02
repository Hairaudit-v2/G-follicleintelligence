import Link from "next/link";
import { AlertTriangle, Banknote, ClipboardList, Phone, Scissors } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";
import type { AttentionPriorityItem } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";

const severityRowClasses = {
  critical: {
    row: "border-red-400/35 bg-red-950/35 hover:border-red-300/50 hover:bg-red-950/45",
    icon: "border-red-400/40 bg-red-950/50 text-red-100",
  },
  warning: {
    row: "border-orange-400/35 bg-orange-950/25 hover:border-orange-300/45 hover:bg-orange-950/35",
    icon: "border-orange-400/40 bg-orange-950/40 text-orange-100",
  },
  normal: {
    row: "border-sky-500/20 bg-sky-950/20 hover:border-cyan-400/35 hover:bg-cyan-950/25",
    icon: "border-sky-400/30 bg-sky-950/35 text-sky-200",
  },
} as const;

function iconForItem(id: string): ReactNode {
  if (id.includes("surgery") || id.includes("readiness")) return <Scissors className="h-4 w-4" />;
  if (id.includes("payment") || id.includes("finance") || id.includes("clearance"))
    return <Banknote className="h-4 w-4" />;
  if (id.includes("consult")) return <ClipboardList className="h-4 w-4" />;
  if (id.includes("lead")) return <Phone className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function AttentionRow({ item }: { item: AttentionPriorityItem }) {
  const tone = severityRowClasses[item.severity];
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-3 transition sm:px-4",
        tone.row
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          tone.icon
        )}
        aria-hidden
      >
        {iconForItem(item.id)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">{item.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
      </div>
    </Link>
  );
}

export function DashboardAttentionPriorities(props: {
  items: readonly AttentionPriorityItem[];
  base: string;
}) {
  const { items, base } = props;

  return (
    <DashboardCard
      className="p-4 sm:p-5"
      role="region"
      aria-labelledby="attention-priorities-heading"
    >
      <SectionHeader
        id="attention-priorities-heading"
        kicker="Priority"
        title="What needs attention"
        description="Top operational priorities for the clinic team — review these first."
      />
      {items.length === 0 ? (
        <DashboardEmptyState
          className="mt-4 max-w-xl py-5 sm:px-6 sm:py-6"
          title="Clinic is on track"
          description="No urgent preparation, payment, consultation, or enquiry items need action right now."
          actionLabel="Open clinic flow"
          actionHref={`${base}/operations`}
        />
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
