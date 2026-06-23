import Link from "next/link";
import {
  Banknote,
  Calendar,
  Scissors,
  Stethoscope,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

type ModuleNavItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export function DashboardModuleNavigation(props: { base: string; showCrmNav: boolean; showBookingsBoard: boolean }) {
  const { base, showCrmNav, showBookingsBoard } = props;

  const modules: ModuleNavItem[] = [
    {
      id: "calendar",
      label: "Calendar",
      description: "Schedule and manage clinic appointments.",
      href: `${base}/calendar`,
      icon: Calendar,
    },
    {
      id: "patientos",
      label: "PatientOS",
      description: "Patient records, journeys, and clinical context.",
      href: `${base}/patients`,
      icon: Stethoscope,
      disabled: !showBookingsBoard,
    },
    {
      id: "leadflow",
      label: "LeadFlow",
      description: "Enquiries, conversion, and lead follow-up.",
      href: `${base}/crm`,
      icon: UserPlus,
      disabled: !showCrmNav,
    },
    {
      id: "surgeryos",
      label: "SurgeryOS",
      description: "Procedure planning, readiness, and surgical workflow.",
      href: `${base}/surgery-os`,
      icon: Scissors,
    },
    {
      id: "financialos",
      label: "FinancialOS",
      description: "Payments, invoices, and financial clearance.",
      href: `${base}/financial/dashboard`,
      icon: Banknote,
    },
    {
      id: "workforceos",
      label: "WorkforceOS",
      description: "Staff onboarding, compliance, and team governance.",
      href: `${base}/hr-os`,
      icon: Users,
    },
  ];

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="module-nav-heading">
      <SectionHeader
        id="module-nav-heading"
        kicker="Workspace"
        title="Cross-module quick workspace"
        description="Move quickly across FI OS — each module holds the full detail."
      />
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const content = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-950/25 text-cyan-300">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-100">{mod.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{mod.description}</span>
              </span>
            </>
          );

          if (mod.disabled) {
            return (
              <div
                key={mod.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 opacity-50",
                )}
                aria-disabled="true"
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#0c1426]/60 px-3 py-3 transition",
                "hover:border-cyan-500/25 hover:bg-[#141c33]/75",
              )}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}
