"use client";

import { UserPlus } from "lucide-react";

import { dispatchOpenCreateLeadModal } from "@/src/lib/fiAdmin/clinicOsShellCreateLeadEvent";

export function DashboardAddLeadAction() {
  return (
    <button
      type="button"
      onClick={() => dispatchOpenCreateLeadModal()}
      className="group flex min-h-[8.5rem] w-full flex-col rounded-2xl border border-white/[0.08] bg-black/20 p-5 text-left transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.06]"
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-cyan-300 transition group-hover:border-cyan-400/30 group-hover:bg-cyan-500/10">
        <UserPlus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base">
        New enquiry
      </div>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
        Capture a new enquiry without leaving the dashboard.
      </p>
      <span className="mt-3 text-xs font-semibold text-cyan-300/90">Open form →</span>
    </button>
  );
}

/** @deprecated Use {@link DashboardAddLeadAction} — thin wrapper for legacy call sites. */
export function DashboardAddLeadQuickCard({ className }: { className?: string }) {
  return (
    <div className={className}>
      <DashboardAddLeadAction />
    </div>
  );
}
