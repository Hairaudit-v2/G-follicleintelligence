import type { PatientSafeImagingExportCard as ExportCard } from "@/src/lib/imaging-os/patientSafeImagingExportCore";

export function PatientSafeImagingExportCardView({ card }: { card: ExportCard }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Patient-safe export
      </p>
      <div className="mt-2 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Photo date</p>
          <p>{card.photo_date ? new Date(card.photo_date).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">View</p>
          <p>{card.view_label ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Session</p>
          <p>{card.session_type ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Progress</p>
          <p>{card.progress_label ?? "—"}</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-emerald-200/90">{card.status_message}</p>
      <p className="mt-1 text-[10px] text-slate-500">
        Redacted card — no diagnosis or prediction included.
      </p>
    </div>
  );
}