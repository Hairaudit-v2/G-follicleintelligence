"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  buildStaffDirectoryHref,
  buildStaffIdentityAuditHref,
  buildWorkforceRosterHref,
  STAFF_LIFECYCLE_HELPERS,
  STAFF_LIFECYCLE_LABELS,
} from "@/src/lib/workforce/staffLifecycleCopy";

export type WorkforceOsNavItem = {
  label: string;
  href: string;
  segment: string;
  title?: string;
};

export function buildWorkforceOsNavItems(
  tenantId: string,
  opts?: { showIdentityAudit?: boolean }
): WorkforceOsNavItem[] {
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const showIdentityAudit = opts?.showIdentityAudit !== false;
  return [
    {
      label: STAFF_LIFECYCLE_LABELS.commandCentreShort,
      href: base,
      segment: "",
    },
    { label: "Planning", href: `${base}/planning`, segment: "planning" },
    {
      label: "Procedure Staffing",
      href: `${base}/procedure-staffing`,
      segment: "procedure-staffing",
    },
    { label: "Payroll", href: `${base}/payroll`, segment: "payroll" },
    { label: "Shift Cost", href: `${base}/shift-cost`, segment: "shift-cost" },
    { label: "Recruitment", href: `${base}/recruitment`, segment: "recruitment" },
    {
      label: "HR Reconciliation",
      href: `${base}/hr-reconciliation`,
      segment: "hr-reconciliation",
    },
    { label: "Members", href: `${base}/directory`, segment: "members" },
    {
      label: STAFF_LIFECYCLE_LABELS.staffAccess,
      href: `${base}/staff-access`,
      segment: "staff-access",
    },
    ...(showIdentityAudit
      ? [
          {
            label: STAFF_LIFECYCLE_LABELS.identityAudit,
            href: buildStaffIdentityAuditHref(tenantId),
            segment: "identity-audit",
            title: STAFF_LIFECYCLE_HELPERS.identityAudit,
          } satisfies WorkforceOsNavItem,
        ]
      : []),
    {
      label: STAFF_LIFECYCLE_LABELS.roster,
      href: buildWorkforceRosterHref(tenantId),
      segment: "roster",
      title: STAFF_LIFECYCLE_HELPERS.roster,
    },
  ];
}

export function isWorkforceOsNavActive(pathname: string, base: string, segment: string): boolean {
  if (!segment) {
    return pathname === base || pathname === `${base}/`;
  }
  if (segment === "members") {
    return pathname.startsWith(`${base}/directory`) || pathname.startsWith(`${base}/staff/`);
  }
  if (segment === "staff-access") {
    return pathname.startsWith(`${base}/staff-access`);
  }
  if (segment === "identity-audit") {
    return pathname.startsWith(`${base}/staff-identity-audit`);
  }
  if (segment === "roster") {
    return pathname.includes("/workforce-os/roster") || pathname.includes("/hr-os/roster");
  }
  return pathname === `${base}/${segment}` || pathname.startsWith(`${base}/${segment}/`);
}

export function WorkforceOsSubNav({
  tenantId,
  showIdentityAudit = true,
}: {
  tenantId: string;
  showIdentityAudit?: boolean;
}) {
  const pathname = usePathname();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const items = buildWorkforceOsNavItems(tenantId, { showIdentityAudit });

  return (
    <nav
      aria-label="Team navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {items.map((item) => {
        const active = isWorkforceOsNavActive(pathname, base, item.segment);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
                : "border-white/[0.08] bg-[#0F1629]/60 text-slate-400 hover:border-white/[0.14] hover:text-slate-200"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href={buildStaffDirectoryHref(tenantId)}
        className="ml-auto rounded-full border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:border-white/[0.12] hover:text-[#94A3B8]"
      >
        {STAFF_LIFECYCLE_LABELS.staffDirectory}
      </Link>
    </nav>
  );
}
