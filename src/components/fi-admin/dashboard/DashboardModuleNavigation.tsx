import Link from "next/link";
import {
  Banknote,
  Calendar,
  Scissors,
  Stethoscope,
  UserCircle,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";

type ModuleNavItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  featureKey?: FiFeatureKey;
};

const MODULES: ModuleNavItem[] = [
  {
    key: "calendar",
    label: "Calendar",
    description: "Schedule, arrivals, and day planning.",
    href: "calendar",
    icon: <Calendar className="h-5 w-5" />,
    featureKey: "calendar",
  },
  {
    key: "patients",
    label: "PatientOS",
    description: "Patient records and care journeys.",
    href: "patients",
    icon: <UserCircle className="h-5 w-5" />,
    featureKey: "patient_twin",
  },
  {
    key: "crm",
    label: "LeadFlow",
    description: "Leads, enquiries, and conversion.",
    href: "crm",
    icon: <Stethoscope className="h-5 w-5" />,
    featureKey: "crm",
  },
  {
    key: "surgery-os",
    label: "SurgeryOS",
    description: "Procedures, readiness, and theatre flow.",
    href: "surgery-os",
    icon: <Scissors className="h-5 w-5" />,
    featureKey: "cases",
  },
  {
    key: "financial-os",
    label: "FinancialOS",
    description: "Payments, invoices, and clearance.",
    href: "financial-os",
    icon: <Banknote className="h-5 w-5" />,
  },
  {
    key: "hr-os",
    label: "WorkforceOS",
    description: "Team rostering and staff coverage.",
    href: "hr-os",
    icon: <Users className="h-5 w-5" />,
  },
];

function moduleVisible(
  item: ModuleNavItem,
  featureAccess: ReadonlyMap<FiFeatureKey, boolean> | null,
  showCrmNav: boolean,
  showBookingsBoard: boolean,
): boolean {
  if (item.key === "crm" && !showCrmNav) return false;
  if (item.key === "patients" && !showBookingsBoard) return false;
  if (!item.featureKey || !featureAccess) return true;
  return featureAccess.get(item.featureKey) !== false;
}

export function DashboardModuleNavigation(props: {
  base: string;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
  featureAccess?: ReadonlyMap<FiFeatureKey, boolean> | null;
}) {
  const { base, showCrmNav, showBookingsBoard, featureAccess = null } = props;
  const items = MODULES.filter((item) => moduleVisible(item, featureAccess, showCrmNav, showBookingsBoard));

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-module-nav-heading">
      <SectionHeader
        id="dash-module-nav-heading"
        kicker="Workspace"
        title="Cross-module quick workspace"
        description="Move quickly through the FI ecosystem — each module holds the full operational detail."
      />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.key}
            href={`${base}/${item.href}`}
            className={cn(
              "group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#0c1426]/60 px-4 py-4 transition",
              "hover:border-cyan-500/25 hover:bg-[#141c33]/75",
            )}
          >
            <span className="mt-0.5 shrink-0 text-cyan-400/85 transition group-hover:text-cyan-300" aria-hidden>
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-100">{item.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
