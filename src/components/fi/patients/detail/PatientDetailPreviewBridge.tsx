"use client";

import Link from "next/link";
import { usePatientSlideOver } from "../PatientSlideOver";

const card = "rounded border border-gray-200 bg-white p-3 shadow-sm";

type RelatedPatientPeek = {
  patientId: string;
  displayName: string;
};

type Props = {
  tenantId: string;
  currentPatientId: string;
  relatedPatients: RelatedPatientPeek[];
  onOpenPreview: (patientId: string) => void;
};

/** Optional related-patient peek strip (URL sync handled by {@link PatientDetailPreviewUrlSync}). */
export function PatientDetailPreviewBridge({ tenantId, currentPatientId, relatedPatients, onOpenPreview }: Props) {
  const { activePatientId } = usePatientSlideOver();
  const others = relatedPatients.filter((r) => r.patientId !== currentPatientId);

  if (others.length === 0) {
    return null;
  }

  return (
    <section className={card} aria-label="Related patient records">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Related records</h2>
          <p className="mt-1 text-xs text-gray-600">Peek another patient in the slide-over without leaving this page.</p>
        </div>
        <p className="text-xs text-gray-500">
          Tip: share <code className="rounded bg-gray-100 px-1 font-mono text-[10px]">?preview=&lt;patient-id&gt;</code>
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {others.map((r) => {
          const isActive = activePatientId === r.patientId;
          return (
            <li
              key={r.patientId}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                isActive ? "border-blue-300 bg-blue-50/80" : "border-gray-100 bg-gray-50/50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{r.displayName}</p>
                <p className="font-mono text-xs text-gray-500">{r.patientId.slice(0, 8)}…</p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  className="text-blue-700 hover:underline"
                  onClick={() => onOpenPreview(r.patientId)}
                >
                  Preview
                </button>
                <Link href={`/fi-admin/${tenantId}/patients/${r.patientId}`} className="text-blue-700 hover:underline">
                  Open →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
