import { Calendar, Stethoscope, Users } from "lucide-react";
import type { ReactNode } from "react";

import { QuickActionCard } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardAddLeadAction } from "@/src/components/fi-admin/dashboard/DashboardAddLeadAction";

export function DashboardPrimaryActions(props: {
  base: string;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
}) {
  const { base, showCrmNav, showBookingsBoard } = props;

  const actions = [
    {
      key: "book",
      title: "Book Appointment",
      description: "Open the calendar and schedule a visit.",
      href: `${base}/calendar`,
      icon: <Calendar className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
      enabled: true,
    },
    {
      key: "patient",
      title: "Add Patient",
      description: "Register a new patient profile.",
      href: `${base}/patients/new`,
      icon: <Users className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
      enabled: showBookingsBoard,
      disabledReason: "Requires scheduling access.",
    },
    {
      key: "lead",
      title: "Add Lead",
      description: "Capture a new enquiry in LeadFlow.",
      modal: true as const,
      enabled: showCrmNav,
      disabledReason: "Requires CRM access.",
    },
    {
      key: "consult",
      title: "Start Consultation",
      description: "Begin a structured consultation workspace.",
      href: `${base}/consultations/new`,
      icon: <Stethoscope className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
      enabled: true,
    },
  ] as const;

  return (
    <section aria-labelledby="dash-primary-actions-heading">
      <h2 id="dash-primary-actions-heading" className="sr-only">
        Primary actions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          if ("modal" in action && action.modal) {
            return action.enabled ? (
              <DashboardAddLeadAction key={action.key} />
            ) : (
              <div
                key={action.key}
                title={action.disabledReason}
                className="flex min-h-[8.5rem] cursor-not-allowed flex-col rounded-2xl border border-dashed border-white/[0.08] bg-black/20 p-5 opacity-55"
              >
                <div className="text-sm font-semibold tracking-tight text-slate-300 sm:text-base">
                  {action.title}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {action.description}
                </p>
              </div>
            );
          }
          return action.enabled ? (
            <QuickActionCard
              key={action.key}
              href={(action as { href: string }).href}
              title={action.title}
              description={action.description}
              icon={(action as { icon: ReactNode }).icon}
              className="min-h-[8.5rem] p-5"
            />
          ) : (
            <div
              key={action.key}
              title={action.disabledReason}
              className="flex min-h-[8.5rem] cursor-not-allowed flex-col rounded-2xl border border-dashed border-white/[0.08] bg-black/20 p-5 opacity-55"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-500">
                {(action as { icon?: ReactNode }).icon}
              </span>
              <div className="text-sm font-semibold tracking-tight text-slate-300 sm:text-base">
                {action.title}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{action.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
