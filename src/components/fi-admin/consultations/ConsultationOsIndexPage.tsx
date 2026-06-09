import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationStatus } from "@/src/lib/consultations/consultationTypes";

const STATUS_FILTER_TABS: { label: string; param: ConsultationStatus | null }[] = [
  { label: "All", param: null },
  { label: "Draft", param: "draft" },
  { label: "In progress", param: "in_progress" },
  { label: "Completed", param: "completed" },
  { label: "Quoted", param: "quoted" },
  { label: "Accepted", param: "accepted" },
  { label: "Converted to patient", param: "converted_to_case" },
  { label: "Archived", param: "archived" },
];

const STATUS_ROW_LABEL: Record<ConsultationStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  quoted: "Quoted",
  accepted: "Accepted",
  converted_to_case: "Converted to patient",
  archived: "Archived",
};

function statusTone(s: ConsultationStatus): "neutral" | "info" | "success" | "warning" {
  if (s === "draft") return "neutral";
  if (s === "in_progress") return "info";
  if (s === "completed" || s === "accepted" || s === "converted_to_case") return "success";
  if (s === "quoted") return "info";
  if (s === "archived") return "neutral";
  return "warning";
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(d));
}

function formatUpdatedAt(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

function filterHref(base: string, param: ConsultationStatus | null): string {
  if (param == null) return `${base}/consultations`;
  return `${base}/consultations?status=${encodeURIComponent(param)}`;
}

export type ConsultationOsIndexPageProps = {
  tenantId: string;
  rows: ConsultationIndexRow[];
  activeStatus: ConsultationStatus | null;
};

export function ConsultationOsIndexPage({ tenantId, rows, activeStatus }: ConsultationOsIndexPageProps) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;

  return (
    <div className="space-y-6">
      <FiPageHeader
        eyebrow="ConsultationOS"
        title="Consultations"
        description="Manage draft consultations, treatment plans and quote-ready assessments."
        primaryAction={
          <Link
            href={`${base}/consultations/new`}
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            New consultation
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_FILTER_TABS.map((tab) => {
          const active = activeStatus === tab.param;
          const href = filterHref(base, tab.param);
          return (
            <Link
              key={tab.label}
              href={href}
              scroll={false}
              className={
                active
                  ? "rounded-full border border-sky-500 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <FiEmptyState
          title="No consultations yet"
          description="Start by creating a digital consultation from the paper treatment plan workflow."
          action={
            <Link
              href={`${base}/consultations/new`}
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              New consultation
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3" aria-label="Consultations list">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{row.consultation_type_label}</p>
                    <FiStatusBadge tone={statusTone(row.status)}>{STATUS_ROW_LABEL[row.status]}</FiStatusBadge>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{row.link_headline}</p>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                    <div>
                      <dt className="inline font-medium text-slate-600">Patient: </dt>
                      <dd className="inline">{row.patient_display_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-600">Lead: </dt>
                      <dd className="inline">{row.lead_display_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-600">Consultation date: </dt>
                      <dd className="inline">{formatIsoDate(row.consultation_date)}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-600">Consultant: </dt>
                      <dd className="inline">{row.consultant_display_name?.trim() || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="inline font-medium text-slate-600">Updated: </dt>
                      <dd className="inline">{formatUpdatedAt(row.updated_at)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="shrink-0">
                  <Link
                    href={`${base}/consultations/${row.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 sm:w-auto"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FiCard>
        <p className="text-sm leading-relaxed text-slate-600">
          ConsultationOS currently supports manual draft creation, saving, and optional patient / CRM lead linking.
          Autosave, AI summary, quote generation and case conversion are planned next.
        </p>
      </FiCard>
    </div>
  );
}
