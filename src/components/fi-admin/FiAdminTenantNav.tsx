"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; home?: boolean; title?: string };

type NavGroup = {
  id: string;
  label: string;
  description?: string;
  items: NavLink[];
};

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

function buildNavGroups(base: string, showCrmNav: boolean, showBookingsBoard: boolean): NavGroup[] {
  const groups: NavGroup[] = [];

  const clinicItems: NavLink[] = [
    {
      href: base,
      label: "Dashboard",
      home: true,
      title: "Clinic — tenant home, agenda context, and daily operations.",
    },
    {
      href: `${base}/operations`,
      label: "Operations",
      title: "Clinic — operations centre, agenda, and links to other boards.",
    },
    {
      href: `${base}/reception`,
      label: "Reception",
      title: "Clinic — today’s reception board and booking flow.",
    },
    {
      href: `${base}/tomorrow`,
      label: "Tomorrow",
      title: "Clinic — end-of-day readiness for tomorrow’s clinic day.",
    },
  ];
  if (showBookingsBoard) {
    clinicItems.push(
      {
        href: `${base}/appointments`,
        label: "Appointments",
        title: "Clinic — appointments list and slide-over actions.",
      },
      {
        href: `${base}/bookings`,
        label: "Board",
        title: "Clinic — legacy booking board and agenda.",
      },
      { href: `${base}/calendar`, label: "Calendar", title: "Clinic — operational calendar." },
      {
        href: `${base}/calendar/testing`,
        label: "Cal. UAT",
        title: "Clinic — calendar UAT checklist (staff, services, probes, seed data).",
      }
    );
  }
  if (showCrmNav) {
    clinicItems.push({
      href: `${base}/system-status`,
      label: "System status",
      title: "Clinic — platform and integration checks.",
    });
  }
  groups.push({
    id: "clinicos",
    label: "Clinic",
    description: "Dashboard, bookings, calendar, daily operations.",
    items: clinicItems,
  });

  groups.push({
    id: "surgeryos",
    label: "Surgery",
    description: "Planning, surgery day, post-op, follow-up.",
    items: [
      {
        href: `${base}/cases`,
        label: "Surgery",
        title: "Surgery — cases, planning, surgery day, and follow-up.",
      },
      {
        href: `${base}/surgery-readiness`,
        label: "Ready for surgery",
        title: "Surgery readiness — 14-day window across bookings and case signals.",
      },
      {
        href: `${base}/procedure-day`,
        label: "Surgery day",
        title: "Surgery day — today’s surgery schedule, team, and procedure progress.",
      },
    ],
  });

  if (showBookingsBoard || showCrmNav) {
    groups.push({
      id: "consultationos",
      label: "Consultations",
      description: "Consultation workspace and conversion funnel.",
      items: [
        {
          href: `${base}/consultations`,
          label: "Consultations",
          title: "Consultations — clinical consultation records and quotes.",
        },
      ],
    });
  }

  const patientItems: NavLink[] = [];
  if (showBookingsBoard) {
    patientItems.push({
      href: `${base}/patients`,
      label: "Patients",
      title: "Patients — patient profile, timeline, and treatment history.",
    });
  }
  patientItems.push({
    href: `${base}/directory`,
    label: "Directory",
    title: "Patients — tenant directory and lookups.",
  });
  groups.push({
    id: "patientos",
    label: "Patients",
    description: "Patient records, profiles, and directory.",
    items: patientItems,
  });

  if (showCrmNav) {
    groups.push({
      id: "leadflow",
      label: "Pipeline",
      description: "Enquiry pipeline, follow-ups, and conversion workflow.",
      items: [
        {
          href: `${base}/crm`,
          label: "Pipeline",
          title: "Pipeline — enquiry board, follow-ups, and lead workspace.",
        },
      ],
    });
  }

  if (showCrmNav) {
    groups.push({
      id: "hr",
      label: "HR",
      description: "Import Evolved HR staff records and link them to FI staff profiles.",
      items: [
        {
          href: `${base}/hr/staff-import`,
          label: "Staff Import",
          title: "Import Evolved HR staff records and link them to FI staff profiles.",
        },
        {
          href: `${base}/hr/staff-readiness`,
          label: "Staff Readiness",
          title: "Operational staff readiness — roles, HR, training, and clinical availability.",
        },
      ],
    });
  }

  groups.push({
    id: "analyticsos",
    label: "Insights",
    description: "Executive KPIs across clinic operations, enquiries, patients, surgery, and quality.",
    items: [
      {
        href: `${base}/analytics`,
        label: "Insights",
        title: "Insights — read-only clinic performance and outcomes.",
      },
    ],
  });

  groups.push({
    id: "auditos",
    label: "Quality review",
    description: "HairAudit queue and outcome quality review.",
    items: [
      {
        href: `${base}/audit`,
        label: "Quality review",
        title: "Quality review — HairAudit queue, evidence, and outcomes.",
      },
    ],
  });

  groups.push({
    id: "foundationos",
    label: "Health record",
    description: "Unified patient identity, media, clinical timeline, and treatment history.",
    items: [
      {
        href: `${base}/foundation-integrity`,
        label: "Health record",
        title:
          "Health record — unified patient identity, media, clinical timeline, and treatment history.",
      },
    ],
  });

  const settingsItems: NavLink[] = [];
  if (showCrmNav || showBookingsBoard) {
    settingsItems.push(
      {
        href: `${base}/staff`,
        label: "Staff",
        title: "Settings — staff directory, working hours, and calendar assignment.",
      },
      {
        href: `${base}/staff/link-users`,
        label: "Link users",
        title: "Settings — repair staff profiles missing fi_user login links.",
      }
    );
  }
  settingsItems.push(
    {
      href: `${base}/services`,
      label: "Services",
      title: "Settings — procedure catalog (durations, types, pricing hints).",
    },
    {
      href: `${base}/rooms`,
      label: "Rooms",
      title: "Settings — clinic rooms and physical room keys for scheduling.",
    },
    {
      href: `${base}/configuration`,
      label: "Configuration",
      title: "Settings — tenant and system configuration.",
    },
    {
      href: `${base}/settings/templates`,
      label: "Templates",
      title: "Settings — booking messages, payment reminders, and sales documents.",
    },
    {
      href: `${base}/settings/calendar`,
      label: "Calendar",
      title: "Settings — calendar visible hours, slots, and display defaults.",
    },
    {
      href: `${base}/settings/tax-localisation`,
      label: "Tax & Localisation",
      title: "Settings — tax, currency, invoice, and regional business settings.",
    },
    {
      href: `${base}/settings/integrations`,
      label: "Integrations",
      title: "Settings — Google Calendar OAuth and other clinic integrations.",
    },
    {
      href: `${base}/settings/integrations/timely`,
      label: "Integrations · Timely",
      title: "Settings — Zapier webhooks for Timely patients and appointments.",
    },
    {
      href: `${base}/settings/integrations/timely/discovery`,
      label: "Integrations · Timely Discovery",
      title: "Settings — capture raw Timely Zapier payloads for inspection (temporary).",
    }
  );
  groups.push({
    id: "settings",
    label: "Settings",
    description: "Tenant, staff, and administration.",
    items: settingsItems,
  });

  return groups;
}

const navBarClass =
  "relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0d182c] via-[#0a1424] to-[#060d18] shadow-lg shadow-black/40";

const linkBase =
  "rounded-lg px-3 py-2 text-sm font-medium text-[#94A3B8] transition duration-200 ease-out hover:bg-white/[0.06] hover:text-[#E2E8F0] sm:text-[0.9375rem]";

const linkActiveClass =
  "bg-[#22C1FF]/12 text-[#22C1FF] shadow-[inset_0_-2px_0_0_rgba(34,193,255,0.85)] ring-1 ring-[#22C1FF]/25";

const groupLabelClass =
  "hidden shrink-0 select-none text-[10px] font-semibold uppercase tracking-wide text-[#64748B] sm:inline sm:pr-1";

/**
 * Tenant FI Admin primary nav — dark bar, cyan active affordance. Link set mirrors server layout
 * (`showCrmNav` / `showBookingsBoard` from `getCrmShellNavAllowed` / `getBookingsBoardNavAllowed`);
 * Patients `/patients` uses bookings-operator eligibility like the patients route layout.
 */
export function FiAdminTenantNav({
  base,
  showCrmNav,
  showBookingsBoard = showCrmNav,
}: {
  base: string;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const groups = buildNavGroups(base, showCrmNav, showBookingsBoard);

  return (
    <nav className={navBarClass} aria-label="FI OS tenant modules">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(700px 200px at 12% 0%, rgba(34, 193, 255, 0.12), transparent 50%), radial-gradient(500px 180px at 90% 0%, rgba(124, 58, 237, 0.08), transparent 45%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-x-1 gap-y-2 overflow-x-auto overscroll-x-contain touch-pan-x px-2 py-2 sm:gap-x-2 sm:px-3 sm:py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => {
          /** Avoid repeating the module name beside a link with the same label (e.g. Patients + Patients). */
          const showGroupLabel =
            group.items.length > 1 && !group.items.some((item) => item.label === group.label);
          return (
            <div
              key={group.id}
              className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-r border-white/[0.08] pr-2 last:border-r-0 last:pr-0 sm:gap-x-1 sm:pr-3"
            >
              {showGroupLabel ? (
                <span className={groupLabelClass} title={group.description}>
                  {group.label}
                </span>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 sm:gap-x-1">
                {group.items.map((item) => {
                  const active = linkActive(pathname, item.href, item.home);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.title}
                      className={cn(linkBase, active && linkActiveClass)}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
