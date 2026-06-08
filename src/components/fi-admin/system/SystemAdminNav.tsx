"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

const LINKS: { href: string; label: string }[] = [
  { href: "/fi-admin/system", label: "Overview" },
  { href: "/fi-admin/system/tenants", label: "Tenants" },
  { href: "/fi-admin/system/clinics", label: "Clinics" },
  { href: "/fi-admin/system/staff", label: "Staff" },
  { href: "/fi-admin/system/doctors", label: "Doctors" },
  { href: "/fi-admin/system/academy", label: "Academy" },
  { href: "/fi-admin/system/services", label: "Services" },
  { href: "/fi-admin/system/medication-catalogue", label: "Medication catalogue" },
  { href: "/fi-admin/system/audit-logs", label: "Audit logs" },
  { href: "/fi-admin/system/permissions", label: "Permissions" },
  { href: "/fi-admin/system/system-settings", label: "System settings" },
  { href: "/fi-admin/system/users", label: "User impersonation" },
];

export function SystemAdminNav() {
  const pathname = usePathname() ?? "";
  const norm = pathname.replace(/\/+$/, "") || "/";
  return (
    <nav
      className="w-full shrink-0 space-y-1 rounded-xl border border-white/[0.08] bg-[#060d18]/90 p-2 lg:w-56"
      aria-label="System administration"
    >
      <p className={cn(fiOsChromeClasses.sectionEyebrow, "px-2 pb-1 pt-1")}>System administration</p>
      {LINKS.map((l) => {
        const active =
          l.href === "/fi-admin/system"
            ? norm === "/fi-admin/system"
            : norm === l.href || norm.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "block rounded-lg px-2 py-2 text-sm font-medium transition",
              active ? "bg-[#22C1FF]/12 text-[#22C1FF]" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
