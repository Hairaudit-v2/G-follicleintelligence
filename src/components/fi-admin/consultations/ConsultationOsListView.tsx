import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationStatus } from "@/src/lib/consultations/consultationTypes";
import {
  consultationOsLinkButtonClass,
  consultationStatusLabel,
  formatConsultationDate,
  formatConsultationDateTime,
} from "@/src/lib/fiAdmin/consultationPresentation";

const STATUS_FILTER_TABS: { label: string; param: ConsultationStatus | null }[] = [
  { label: "All", param: null },
  { label: "Draft", param: "draft" },
  { label: "In progress", param: "in_progress" },
  { label: "Completed", param: "completed" },
  { label: "Quoted", param: "quoted" },
  { label: "Accepted", param: "accepted" },
  { label: "Converted", param: "converted_to_case" },
  { label: "Archived", param: "archived" },
];

function statusToneClass(status: ConsultationStatus): string {
  if (status === "draft") return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";
  if (status === "in_progress") return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30";
  if (status === "completed" || status === "accepted" || status === "converted_to_case") {
    return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
  }
  if (status === "quoted") return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30";
  return "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25";
}

function filterHref(base: string, param: ConsultationStatus | null): string {
  if (param == null) return `${base}/consultations?view=list`;
  return `${base}/consultations?view=list&status=${encodeURIComponent(param)}`;
}

export type ConsultationOsListViewProps = {
  tenantId: string;
  rows: ConsultationIndexRow[];
  activeStatus: ConsultationStatus | null;
};

export function ConsultationOsListView({
  tenantId,
  rows,
  activeStatus,
}: ConsultationOsListViewProps) {
  const base = `/fi-admin/${tenantId}`;

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-6 pb-10 sm:space-y-8 sm:pb-14">
      <DashboardCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`${base}/consultations`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300/90 transition hover:text-violet-200"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to workspace
            </Link>
            <SectionHeader
              kicker="Records"
              title="All consultations"
              description="Full consultation list with status filters."
              className="mt-3"
            />
          </div>
          <Link href={`${base}/consultations/new`} className={consultationOsLinkButtonClass}>
            New consultation
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {STATUS_FILTER_TABS.map((tab) => {
            const active = activeStatus === tab.param;
            return (
              <Link
                key={tab.label}
                href={filterHref(base, tab.param)}
                scroll={false}
                className={
                  active
                    ? "rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200"
                    : "rounded-full border border-white/[0.08] bg-[#0c1220]/60 px-3 py-1.5 text-xs font-medium text-[#94A3B8] transition hover:border-white/[0.14] hover:text-[#E2E8F0]"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </DashboardCard>

      {rows.length === 0 ? (
        <DashboardCard className="p-8 text-center">
          <p className="text-lg font-semibold text-[#F8FAFC]">No consultations found</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            {activeStatus
              ? `No consultations with status “${consultationStatusLabel(activeStatus)}”.`
              : "Start by creating a new consultation."}
          </p>
          <Link
            href={`${base}/consultations/new`}
            className={`mt-4 ${consultationOsLinkButtonClass}`}
          >
            New consultation
          </Link>
        </DashboardCard>
      ) : (
        <ul className="space-y-3" aria-label="Consultations list">
          {rows.map((row) => (
            <li key={row.id}>
              <DashboardCard className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#F8FAFC]">
                        {row.consultation_type_label}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusToneClass(row.status)}`}
                      >
                        {consultationStatusLabel(row.status)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#CBD5E1]">{row.link_headline}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
                      <span>Date: {formatConsultationDate(row.consultation_date)}</span>
                      {row.consultant_display_name ? (
                        <span>Clinician: {row.consultant_display_name}</span>
                      ) : null}
                      <span>Updated: {formatConsultationDateTime(row.updated_at)}</span>
                    </div>
                  </div>
                  <Link
                    href={`${base}/consultations/${row.id}`}
                    className={consultationOsLinkButtonClass}
                  >
                    Open consultation
                  </Link>
                </div>
              </DashboardCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
