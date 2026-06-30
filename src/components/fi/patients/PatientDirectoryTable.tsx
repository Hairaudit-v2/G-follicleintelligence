"use client";

import Link from "next/link";
import type { PatientDirectoryRow as PatientDirectoryRowModel } from "@/src/lib/patients/patientDirectoryLoader";
import {
  formatPatientLifetimeValueGbp,
  truncateClinicalSummary,
} from "@/src/lib/patients/patientDirectoryMetrics";
import { usePatientSlideOverOptional } from "./PatientSlideOver";
import { PatientSlideOverTrigger } from "./PatientSlideOverTrigger";
import { PatientStatusBadge } from "./PatientStatusBadge";

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function PatientDirectoryTable({
  tenantId,
  rows,
}: {
  tenantId: string;
  rows: PatientDirectoryRowModel[];
}) {
  const slide = usePatientSlideOverOptional();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/[0.08] text-sm">
        <thead className="bg-white/[0.03]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Patient
            </th>
            <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 md:table-cell">
              Contact
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </th>
            <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 sm:table-cell">
              Norwood summary
            </th>
            <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 lg:table-cell">
              Next appointment
            </th>
            <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 xl:table-cell">
              Last visit
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              Procedures
            </th>
            <th className="hidden px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 sm:table-cell">
              Lifetime value
            </th>
            <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 lg:table-cell">
              Lead source
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              Patients
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((row) => {
            const profileHref = `/fi-admin/${tenantId}/patients/${row.patientId}`;
            const apptHref = row.nextAppointmentId
              ? `/fi-admin/${tenantId}/appointments/${row.nextAppointmentId}`
              : null;
            const contact = [row.email, row.phone].filter(Boolean).join(" · ") || "—";
            const norwoodLine = truncateClinicalSummary(row.clinicalScalesSummary);
            const nameCell = slide ? (
              <PatientSlideOverTrigger
                patientId={row.patientId}
                className="text-left font-medium text-blue-300 hover:underline"
              >
                {row.displayName}
              </PatientSlideOverTrigger>
            ) : (
              <Link href={profileHref} className="font-medium text-blue-300 hover:underline">
                {row.displayName}
              </Link>
            );

            return (
              <tr
                key={row.patientId}
                className="hover:bg-white/[0.03]"
                onClick={(e) => {
                  if (!slide) return;
                  const t = e.target as HTMLElement;
                  if (t.closest("button, a")) return;
                  slide.openPatient(row.patientId);
                }}
              >
                <td className="px-3 py-2">{nameCell}</td>
                <td className="hidden px-3 py-2 text-xs text-slate-400 md:table-cell">{contact}</td>
                <td className="px-3 py-2">
                  <PatientStatusBadge status={row.patientStatus} />
                </td>
                <td
                  className="hidden max-w-[14rem] px-3 py-2 text-xs text-slate-300 sm:table-cell"
                  title={row.clinicalScalesSummary ?? undefined}
                >
                  {norwoodLine}
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  {apptHref ? (
                    <Link
                      href={apptHref}
                      className="text-xs text-blue-300 hover:underline"
                      title={row.nextAppointmentTitle ?? undefined}
                    >
                      {fmtTs(row.nextAppointmentAt)}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-slate-400 xl:table-cell">
                  {fmtTs(row.lastVisitAt)}
                </td>
                <td className="px-3 py-2 text-center text-xs tabular-nums text-slate-200">
                  {row.totalProcedures}
                </td>
                <td className="hidden px-3 py-2 text-right text-xs tabular-nums text-slate-200 sm:table-cell">
                  {formatPatientLifetimeValueGbp(row.lifetimeValueGbp)}
                </td>
                <td className="hidden px-3 py-2 text-xs text-slate-300 lg:table-cell">
                  {row.primaryLeadSource ?? "—"}
                </td>
                <td className="px-3 py-2 text-center text-xs tabular-nums text-slate-300">
                  {row.activeCaseCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
