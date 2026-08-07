"use client";

import type { AllocationMapViewModel } from "@/src/lib/cases/surgeryProjection/allocationMapModel";
import type { HairlineDesignRow } from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import type { SurgeryProjectionReadiness } from "@/src/lib/cases/surgeryProjection/readiness";

export function SurgeryProjectionReviewDrawer({
  open,
  onClose,
  readiness,
  allocationModel,
  approvedHairline,
}: {
  open: boolean;
  onClose: () => void;
  readiness: SurgeryProjectionReadiness;
  allocationModel: AllocationMapViewModel;
  approvedHairline: HairlineDesignRow | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" role="dialog" aria-modal>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/[0.08] bg-[#0B1220] p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Review / correction</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          One shared drawer — correction forms are not repeated under every artifact.
        </p>

        <section className="mt-4 space-y-2 text-xs text-slate-300">
          <h4 className="font-medium text-slate-100">Allocation map</h4>
          <p>{allocationModel.patientSafeLabel}</p>
          <p>
            Zones: {allocationModel.zones.length} · Grafts: {allocationModel.totalGrafts || "—"}
          </p>
          {allocationModel.warnings[0] ? (
            <p className="text-amber-200">Primary warning: {allocationModel.warnings[0]}</p>
          ) : null}
        </section>

        <section className="mt-4 space-y-2 text-xs text-slate-300">
          <h4 className="font-medium text-slate-100">Hairline</h4>
          {approvedHairline ? (
            <p>
              Approved v{approvedHairline.designVersion} · checksum{" "}
              {approvedHairline.sourceImageChecksum.slice(0, 12)}…
            </p>
          ) : (
            <p>No approved photo-bound hairline yet.</p>
          )}
        </section>

        <section className="mt-4 space-y-2 text-xs text-slate-300">
          <h4 className="font-medium text-slate-100">Projected outcome</h4>
          <p>Lifecycle: {readiness.lifecycleHint}</p>
          <p>Patient sharing: unavailable</p>
          {readiness.blockers.map((b) => (
            <p key={b} className="text-amber-100">
              {b}
            </p>
          ))}
        </section>

        <p className="mt-6 text-[11px] text-slate-500">
          Rejecting a projection must not reject the consultation, surgical plan, graft allocation, or
          approved hairline design.
        </p>
      </div>
    </div>
  );
}
