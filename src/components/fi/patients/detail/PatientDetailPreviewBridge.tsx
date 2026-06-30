"use client";

import Link from "next/link";
import { usePatientSlideOver } from "../PatientSlideOver";

const card = "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40";

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
          <p className="mt-1 text-xs text-slate-400">Peek another patient in the slide-over without leaving this page.</p>
        </div>
        <p className="text-xs text-gray-500">
          Tip: share <code className="rounded bg-white/[0.06] px-1 font-mono text-[10px]">?preview=&lt;patient-id&gt;</code>
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {others.map((r) => {
          const isActive = activePatientId === r.patientId;
          return (
            <li
              key={r.patientId}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                isActive ? "border-blue-300 bg-blue-500/10" : "border-white/[0.06] bg-white/[0.03]"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{r.displayName}</p>
                <p className="font-mono text-xs text-gray-500">{r.patientId.slice(0, 8)}…</p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  className="text-blue-300 hover:underline"
                  onClick={() => onOpenPreview(r.patientId)}
                >
                  Preview
                </button>
                <Link href={`/fi-admin/${tenantId}/patients/${r.patientId}`} className="text-blue-300 hover:underline">
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
