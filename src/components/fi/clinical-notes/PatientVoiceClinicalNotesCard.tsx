"use client";

import Link from "next/link";

import type { PatientClinicalNoteSummary } from "@/src/lib/clinicalNotes/clinicalNotesLoaders.server";

function statusLabel(s: PatientClinicalNoteSummary["record_status"]): string {
  if (s === "ai_draft") return "AI draft";
  if (s === "approved") return "Approved";
  return "Archived";
}

function statusClass(s: PatientClinicalNoteSummary["record_status"]): string {
  if (s === "ai_draft") return "bg-amber-100 text-amber-950";
  if (s === "approved") return "bg-emerald-100 text-emerald-950";
  return "bg-gray-100 text-gray-700";
}

export function PatientVoiceClinicalNotesCard({
  tenantId,
  items,
}: {
  tenantId: string;
  items: PatientClinicalNoteSummary[];
}) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Clinical notes (voice)</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        AI-generated entries stay in <strong>AI draft</strong> until a clinician approves them. Use the{" "}
        <strong>Voice note</strong> button in the Actions bar above to record or upload audio.
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">No voice clinical notes yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((row) => (
            <li key={row.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(row.record_status)}`}>
                  {statusLabel(row.record_status)}
                </span>
                <span className="font-mono text-[10px] text-gray-400">{row.id.slice(0, 8)}…</span>
                <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</span>
                {row.case_id ? (
                  <Link
                    href={`/fi-admin/${tenantId.trim()}/cases/${row.case_id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Case
                  </Link>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-gray-800">{row.preview}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
