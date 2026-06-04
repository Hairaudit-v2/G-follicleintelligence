import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type NewPatientEntryPageProps = {
  tenantId: string;
  /** When false, lead and booking paths are shown disabled with guidance. */
  showCrmNav: boolean;
};

function EntryCardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:min-h-[240px] sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function NewPatientEntryPage({ tenantId, showCrmNav }: NewPatientEntryPageProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const crmHref = `${base}/crm`;
  const bookingsHref = `${base}/bookings/new`;

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

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Add new patient</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Start from a lead, booking, or direct patient profile.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {/* A. Create from lead */}
        {showCrmNav ? (
          <Link
            href={crmHref}
            className="group flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200/90 hover:bg-sky-50/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 sm:min-h-[240px] sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900">Create from lead</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Best for website, phone, or social enquiries.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
              Open CRM leads
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ) : (
          <EntryCardShell className="border-dashed bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-800">Create from lead</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Best for website, phone, or social enquiries.
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
          </EntryCardShell>
        )}

        {/* B. Create from booking */}
        {showCrmNav ? (
          <Link
            href={bookingsHref}
            className="group flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200/90 hover:bg-sky-50/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 sm:min-h-[240px] sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900">Create from booking</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Best when the patient is ready to book a consultation or treatment.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
              Create booking
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ) : (
          <EntryCardShell className="border-dashed bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-800">Create from booking</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Best when the patient is ready to book a consultation or treatment.
            </p>
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950">
              CRM workspace access is required for bookings. Ask an administrator if you need this path.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              Create booking
            </button>
          </EntryCardShell>
        )}

        {/* C. Direct patient profile */}
        <EntryCardShell className="border-dashed bg-slate-50/80">
          <h2 className="text-lg font-semibold text-slate-800">Direct patient profile</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
            For walk-ins, existing patients, or clinical records that do not begin as a lead.
          </p>
          <p className="mt-3 text-xs text-slate-500">Full direct entry is not available in this release.</p>
          <button
            type="button"
            disabled
            className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400"
            title="Coming soon"
          >
            Coming soon
          </button>
        </EntryCardShell>
      </div>
    </div>
  );
}
