import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";

type NewPatientEntryPageProps = {
  tenantId: string;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
};

export function NewPatientEntryPage({ tenantId, showCrmNav, showBookingsBoard }: NewPatientEntryPageProps) {
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

      <FiPageHeader
        title="Add new patient"
        description="Start from a lead, booking, or direct patient profile."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {showCrmNav ? (
          <FiQuickActionCard
            title="Create from lead"
            description="Best for website, phone, or social enquiries."
            href={crmHref}
            openAffordanceLabel="Open CRM leads"
          />
        ) : (
          <FiCard className="flex min-h-[220px] flex-col border-dashed bg-slate-50/80 sm:min-h-[240px]">
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
          </FiCard>
        )}

        {showBookingsBoard ? (
          <FiQuickActionCard
            title="Create from booking"
            description="Best when the patient is ready to book a consultation or treatment."
            href={bookingsHref}
            openAffordanceLabel="Create booking"
          />
        ) : (
          <FiCard className="flex min-h-[220px] flex-col border-dashed bg-slate-50/80 sm:min-h-[240px]">
            <h2 className="text-lg font-semibold text-slate-800">Create from booking</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              Best when the patient is ready to book a consultation or treatment.
            </p>
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950">
              Scheduling access requires an Administrator or CRM operator role, or an active link to this tenant in Staff.
              Ask an administrator if you need this path.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              Create booking
            </button>
          </FiCard>
        )}

        <FiCard className="flex min-h-[220px] flex-col border-dashed bg-slate-50/80 sm:min-h-[240px]">
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
        </FiCard>
      </div>
    </div>
  );
}
