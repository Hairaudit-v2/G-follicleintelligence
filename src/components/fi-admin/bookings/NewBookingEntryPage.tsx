import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";

type NewBookingEntryPageProps = {
  tenantId: string;
  /** CRM leads + full CRM shell (fi_admin, admin, crm_operator). */
  showCrmNav: boolean;
  /** Bookings operator + scheduling entry (CRM shell roles or active `fi_staff` member). */
  showBookingsBoard: boolean;
};

/**
 * Stage 1E: safe booking pathway launcher (UI only). No inserts or server actions.
 * Shown under `/fi-admin/[tenantId]/bookings/new` for staff choosing how to proceed.
 */
export function NewBookingEntryPage({ tenantId, showCrmNav, showBookingsBoard }: NewBookingEntryPageProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const crmHref = `${base}/crm`;
  const bookingsHref = `${base}/bookings`;
  const casesHref = `${base}/cases`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={base}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </div>

      <FiPageHeader
        title="Book appointment"
        description="Choose the safest way to book a consultation, treatment, or hair-transplant-related appointment."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        <FiCard className="flex min-h-[200px] flex-col border-dashed bg-white/[0.03] sm:min-h-[220px]">
          <h2 className="text-lg font-semibold text-slate-200">Book from existing patient</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
            Use this when the person already has a patient profile.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-400"
            title="Coming soon"
          >
            Coming soon
          </button>
        </FiCard>

        {showCrmNav ? (
          <FiQuickActionCard
            title="Book from lead"
            description="Use this when the appointment is connected to a new enquiry or sales pipeline."
            href={crmHref}
            openAffordanceLabel="Open CRM leads"
          />
        ) : (
          <FiCard className="flex min-h-[200px] flex-col border-dashed bg-white/[0.03] sm:min-h-[220px]">
            <h2 className="text-lg font-semibold text-slate-200">Book from lead</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
              Use this when the appointment is connected to a new enquiry or sales pipeline.
            </p>
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-snug text-amber-200">
              CRM workspace access is required to open leads. Ask an administrator if you need this path.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              Open CRM leads
            </button>
          </FiCard>
        )}

        {showBookingsBoard ? (
          <FiQuickActionCard
            title="Create consultation booking"
            description="Use this for new consultations, assessments, or follow-up appointments."
            href={bookingsHref}
            openAffordanceLabel="Open bookings"
          />
        ) : (
          <FiCard className="flex min-h-[200px] flex-col border-dashed bg-white/[0.03] sm:min-h-[220px]">
            <h2 className="text-lg font-semibold text-slate-200">Create consultation booking</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
              Use this for new consultations, assessments, or follow-up appointments.
            </p>
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-snug text-amber-200">
              Scheduling access requires an Administrator or CRM operator role, or an active link to this tenant in Staff.
              Ask an administrator if you need this path.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              Open bookings
            </button>
          </FiCard>
        )}

        <FiQuickActionCard
          title="Hair transplant or treatment planning"
          description="Use this when the appointment relates to an active surgical or treatment patient."
          href={casesHref}
          openAffordanceLabel="Open patients"
        />
      </div>
    </div>
  );
}
