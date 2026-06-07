import { Briefcase, CalendarPlus, UserPlus, Users } from "lucide-react";

import { DashboardCard, QuickActionCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { cn } from "@/lib/utils";

const ICON = 22;

export function DashboardQuickActions(props: {
  tenantId: string;
  showCrmNav: boolean;
  /** Self-service HR route — only when the viewer has `fi_staff.fi_user_id` set for this tenant. */
  showMyHrPortal?: boolean;
}) {
  const { tenantId, showCrmNav, showMyHrPortal } = props;
  const base = `/fi-admin/${tenantId}`;

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-actions-heading">
      <SectionHeader
        id="dash-actions-heading"
        title="Quick actions"
        description="Shortcuts for common intake and scheduling flows."
        className="mb-4"
      />
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          showMyHrPortal ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
        )}
      >
        {showCrmNav ? (
          <QuickActionCard
            href={`${base}/crm`}
            title="New lead"
            description="Open the CRM workspace to create or manage leads."
            icon={<UserPlus size={ICON} strokeWidth={1.75} aria-hidden />}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#081020]/30 p-4 text-sm text-[#94A3B8]">
            <p className="font-medium text-[#E2E8F0]">New lead</p>
            <p className="mt-1 text-xs">CRM access is not enabled for your role on this tenant.</p>
          </div>
        )}
        <QuickActionCard
          href={`${base}/bookings/new`}
          title="New booking"
          description="Schedule a visit linked to a lead, patient, or clinical patient."
          icon={<CalendarPlus size={ICON} strokeWidth={1.75} aria-hidden />}
        />
        <QuickActionCard
          href={`${base}/patients/new`}
          title="New patient"
          description="Start a patient record from intake or conversion."
          icon={<Users size={ICON} strokeWidth={1.75} aria-hidden />}
        />
        {showMyHrPortal ? (
          <QuickActionCard
            href={`${base}/staff/me/hr`}
            title="My HR Portal"
            description="View your staff documents and onboarding."
            icon={<Briefcase size={ICON} strokeWidth={1.75} aria-hidden />}
          />
        ) : null}
      </div>
    </DashboardCard>
  );
}
