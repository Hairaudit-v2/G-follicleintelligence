import Link from "next/link";
import { ArrowRight, Pill } from "lucide-react";

import type {
  DoctorPrescriptionItem,
  DoctorPrescriptionWorkspaceModel,
} from "@/src/lib/fiAdmin/doctorWorkspacePresentation";
import { doctorWorkspaceLinkButtonClass } from "@/src/lib/fiAdmin/doctorWorkspacePresentation";
import { cn } from "@/lib/utils";

function formatShortDate(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PrescriptionItemRow({ item }: { item: DoctorPrescriptionItem }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition hover:border-emerald-400/30",
        item.tone === "urgent"
          ? "border-rose-500/25 bg-rose-500/[0.06]"
          : item.tone === "warn"
            ? "border-amber-500/20 bg-amber-500/[0.04]"
            : "border-white/[0.06] bg-[#0c1220]/60"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#F8FAFC]">{item.patientLabel}</p>
        <p className="mt-0.5 text-xs text-[#94A3B8]">
          {item.statusLabel} · {item.detail}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-[#64748B]">{formatShortDate(item.updatedAt)}</span>
    </Link>
  );
}

function PrescriptionGroup({ title, items }: { title: string; items: DoctorPrescriptionItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <PrescriptionItemRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DoctorPrescriptionWorkspace({
  base,
  model,
  compact = false,
}: {
  base: string;
  model: DoctorPrescriptionWorkspaceModel;
  compact?: boolean;
}) {
  const hasContent =
    model.awaitingApproval.length > 0 ||
    model.inProgressDrafts.length > 0 ||
    model.medicationAlerts.length > 0 ||
    model.requiringRenewal.length > 0 ||
    model.activePrescriptions.length > 0 ||
    model.recentIssued.length > 0;

  return (
    <div className="space-y-5">
      {!model.hasAnyActions && !hasContent ? (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-4">
          <p className="text-sm leading-relaxed text-[#CBD5E1]">
            No active prescription actions require physician review at this time.
          </p>
        </div>
      ) : (
        <div className={cn("grid gap-5", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
          <PrescriptionGroup title="Awaiting approval" items={model.awaitingApproval} />
          <PrescriptionGroup title="Drafts in progress" items={model.inProgressDrafts} />
          <PrescriptionGroup title="Medication alerts" items={model.medicationAlerts} />
          <PrescriptionGroup title="Renewals requiring review" items={model.requiringRenewal} />
          {!compact ? (
            <>
              <PrescriptionGroup title="Active prescriptions" items={model.activePrescriptions} />
              <PrescriptionGroup title="Recently issued" items={model.recentIssued} />
            </>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`${base}/prescriptions/new`} className={doctorWorkspaceLinkButtonClass}>
          <Pill className="mr-1.5 h-4 w-4" aria-hidden />
          New Prescription
        </Link>
        <Link href={`${base}/prescriptions`} className={doctorWorkspaceLinkButtonClass}>
          Open Prescription History
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export type { DoctorPrescriptionWorkspaceModel };
