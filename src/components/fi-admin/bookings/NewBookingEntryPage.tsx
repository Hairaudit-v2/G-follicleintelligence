import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type NewBookingEntryPageProps = {
  tenantId: string;
  /** When false, CRM- and booking-board paths are shown disabled with guidance (mirrors CRM shell nav). */
  showCrmNav: boolean;
};

function WorkflowCardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:min-h-[220px] sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Stage 1E: safe booking pathway launcher (UI only). No inserts or server actions.
 * Shown under `/fi-admin/[tenantId]/bookings/new` for staff choosing how to proceed.
 */
export function NewBookingEntryPage({ tenantId, showCrmNav }: NewBookingEntryPageProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const crmHref = `${base}/crm`;
  const bookingsHref = `${base}/bookings`;
  const casesHref = `${base}/cases`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={base}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Book appointment</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Choose the safest way to book a consultation, treatment, or surgery-related appointment.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {/* A. Book from existing patient — coming soon */}
        <WorkflowCardShell className="border-dashed bg-slate-50/80">
          <h2 className="text-lg font-semibold text-slate-800">Book from existing patient</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
            Use this when the person already has a patient profile.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400"
            title="Coming soon"
          >
            Coming soon
          </button>
        </WorkflowCardShell>

        {/* B. Book from lead */}
        {showCrmNav ? (
          <Link
            href={crmHref}
            className="group flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200/90 hover:bg-sky-50/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 sm:min-h-[220px] sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900">Book from lead</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Use this when the appointment is connected to a new enquiry or sales pipeline.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
              Open CRM leads
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ) : (
          <WorkflowCardShell className="border-dashed bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-800">Book from lead</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Use this when the appointment is connected to a new enquiry or sales pipeline.
            </p>
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950">
              CRM workspace access is required to open leads. Ask an administrator if you need this path.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              Open CRM leads
            </button>
          </WorkflowCardShell>
        )}

        {/* C. Create consultation booking */}
        {showCrmNav ? (
          <Link
            href={bookingsHref}
            className="group flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200/90 hover:bg-sky-50/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 sm:min-h-[220px] sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900">Create consultation booking</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Use this for new consultations, assessments, or follow-up appointments.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
              Open bookings
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ) : (
          <WorkflowCardShell className="border-dashed bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-800">Create consultation booking</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Use this for new consultations, assessments, or follow-up appointments.
            </p>
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950">
              CRM workspace access is required for bookings. Ask an administrator if you need this path.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              Open bookings
            </button>
          </WorkflowCardShell>
        )}

        {/* D. Surgery or treatment planning */}
        <Link
          href={casesHref}
          className="group flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200/90 hover:bg-sky-50/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 sm:min-h-[220px] sm:p-6"
        >
          <h2 className="text-lg font-semibold text-slate-900">Surgery or treatment planning</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
            Use this when the appointment relates to an active surgical or treatment case.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
            Open cases
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      </div>
    </div>
  );
}
