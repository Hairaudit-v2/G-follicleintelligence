"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarResourceView,
  type CalendarRoute,
  type CalendarStaffRoleBucket,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";

const TYPE_CHIPS: { id: string; label: string; type: string }[] = [
  { id: "consultation", label: "Consultations", type: "consultation" },
  { id: "prp", label: "PRP", type: "prp" },
  { id: "surgery", label: "Surgery", type: "surgery" },
  { id: "follow_up", label: "Follow-up", type: "follow_up" },
];

export function FiOsCalendarQuickFilters({
  tenantId,
  query,
  clinics,
  route = "fi-admin",
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  clinics: CrmShellClinicOption[];
  route?: CalendarRoute;
}) {
  const router = useRouter();
  const hrefOpts = { route };

  function typeHref(t: string): string {
    const active = query.bookingType?.trim() === t;
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, { type: active ? null : t }),
      hrefOpts
    );
  }

  function roleHref(bucket: CalendarStaffRoleBucket): string {
    const active = query.staffRoleBucket === bucket && !query.staffId?.trim();
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        role: active ? null : bucket,
        staffId: null,
      }),
      hrefOpts
    );
  }

  const clinicChipActive = Boolean(query.clinicId?.trim());
  const firstClinicId = clinics[0]?.id;

  function onClinicRoomClick() {
    const href = buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        clinicId: clinicChipActive ? null : firstClinicId ?? null,
      }),
      hrefOpts
    );
    router.push(href);
  }

  function resourceViewHref(view: CalendarResourceView): string {
    const active = query.resourceView === view;
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        resourceView: active && view !== "staff" ? null : view,
      }),
      hrefOpts
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#060d18]/80 px-3 py-2.5 backdrop-blur-md sm:px-4">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quick filters</span>
      <Link
        href={resourceViewHref("staff")}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          query.resourceView === "staff"
            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
        )}
      >
        By staff
      </Link>
      <Link
        href={resourceViewHref("room")}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          query.resourceView === "room"
            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
        )}
      >
        By room
      </Link>
      <Link
        href={resourceViewHref("clinic")}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          query.resourceView === "clinic"
            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
        )}
      >
        By clinic
      </Link>
      {TYPE_CHIPS.map((c) => {
        const active = query.bookingType?.trim() === c.type;
        return (
          <Link
            key={c.id}
            href={typeHref(c.type)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              active
                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.12)]"
                : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
            )}
          >
            {c.label}
          </Link>
        );
      })}
      <Link
        href={roleHref("doctor")}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          query.staffRoleBucket === "doctor" && !query.staffId?.trim()
            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
        )}
      >
        Doctor
      </Link>
      <Link
        href={roleHref("nurse")}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          query.staffRoleBucket === "nurse" && !query.staffId?.trim()
            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
        )}
      >
        Nurse
      </Link>
      <button
        type="button"
        onClick={onClinicRoomClick}
        disabled={!clinicChipActive && !firstClinicId}
        title={
          !firstClinicId && !clinicChipActive
            ? "No clinic sites configured"
            : clinicChipActive
              ? "Show all locations"
              : `Focus ${clinics[0]?.display_name ?? "first site"}`
        }
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
          clinicChipActive
            ? "border-violet-400/35 bg-violet-500/15 text-violet-100"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-violet-400/30 hover:text-white"
        )}
      >
        Clinic room
      </button>
    </div>
  );
}
