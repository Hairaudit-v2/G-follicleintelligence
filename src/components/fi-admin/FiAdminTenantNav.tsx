"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; home?: boolean };

function normalizePath(p: string): string {
  const t = p.replace(/\/+$/, "");
  return t.length === 0 ? "/" : t;
}

function linkActive(pathname: string, href: string, isHome?: boolean): boolean {
  const p = normalizePath(pathname);
  const h = normalizePath(href);
  if (isHome) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

function buildNavItems(base: string, showCrmNav: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: base, label: "Home", home: true },
    { href: `${base}/cases`, label: "Patients" },
    { href: `${base}/audit`, label: "Audit queue" },
    { href: `${base}/directory`, label: "Directory" },
    { href: `${base}/configuration`, label: "Configuration" },
    { href: `${base}/settings/reminders`, label: "Reminders" },
    { href: `${base}/foundation-integrity`, label: "Foundation integrity" },
  ];
  if (showCrmNav) {
    items.push(
      { href: `${base}/patients`, label: "Patients" },
      { href: `${base}/crm`, label: "CRM" },
      { href: `${base}/bookings`, label: "Bookings" },
      { href: `${base}/calendar`, label: "Calendar" },
      { href: `${base}/system-status`, label: "System Status" },
    );
  }
  return items;
}

const navBarClass =
  "relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0d182c] via-[#0a1424] to-[#060d18] shadow-lg shadow-black/40";

const linkBase =
  "rounded-lg px-3 py-2 text-sm font-medium text-[#94A3B8] transition duration-200 ease-out hover:bg-white/[0.06] hover:text-[#E2E8F0] sm:text-[0.9375rem]";

const linkActiveClass =
  "bg-[#22C1FF]/12 text-[#22C1FF] shadow-[inset_0_-2px_0_0_rgba(34,193,255,0.85)] ring-1 ring-[#22C1FF]/25";

/**
 * Tenant FI Admin primary nav — dark bar, cyan active affordance. Link set mirrors server layout (role-based via showCrmNav).
 */
export function FiAdminTenantNav({ base, showCrmNav }: { base: string; showCrmNav: boolean }) {
  const pathname = usePathname() ?? "";
  const items = buildNavItems(base, showCrmNav);

  return (
    <nav className={navBarClass} aria-label="Tenant admin">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(700px 200px at 12% 0%, rgba(34, 193, 255, 0.12), transparent 50%), radial-gradient(500px 180px at 90% 0%, rgba(124, 58, 237, 0.08), transparent 45%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-x-0.5 gap-y-1 px-2 py-2 sm:gap-x-1 sm:px-3 sm:py-2.5">
        {items.map((item) => {
          const active = linkActive(pathname, item.href, item.home);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(linkBase, active && linkActiveClass)}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
