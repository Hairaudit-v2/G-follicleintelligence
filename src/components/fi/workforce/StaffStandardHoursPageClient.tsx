"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { StaffHrTaskMapEntryBanner } from "@/src/components/fi/workforce/StaffHrTaskMapEntryBanner";
import { StaffStandardHoursPanel } from "@/src/components/fi/workforce/StaffStandardHoursPanel";
import type { DefaultFullTimePattern, RosterCadence } from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  buildStaffStandardHoursEditorHref,
  buildStaffStandardHoursReturnToRosterHref,
} from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export type StaffStandardHoursIndexClientProps = {
  tenantId: string;
  canManage: boolean;
  manageDeniedReason: string;
  staffOptions: Array<{
    id: string;
    name: string;
    role: string | null;
    hasStandardHours: boolean;
  }>;
  staffMissingStandardHours: Array<{ id: string; name: string }>;
};

export function StaffStandardHoursIndexClient({
  tenantId,
  canManage,
  manageDeniedReason,
  staffOptions,
  staffMissingStandardHours,
}: StaffStandardHoursIndexClientProps) {
  const rosterHref = buildStaffStandardHoursReturnToRosterHref(tenantId);

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "space-y-6 pb-10")}>
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Team</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Standard hours</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Set each staff member&apos;s working pattern before generating rosters or allocating patients.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <Link href={rosterHref} className="text-cyan-400 hover:text-cyan-300">
            Back to roster
          </Link>
        </p>
      </header>

      <StaffHrTaskMapEntryBanner tenantId={tenantId} surface="standard_hours" />

      {!canManage ? (
        <p
          className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100"
          data-testid="standard-hours-manage-denied"
        >
          {manageDeniedReason}
        </p>
      ) : null}

      {staffMissingStandardHours.length > 0 ? (
        <section
          className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3"
          data-testid="standard-hours-missing-banner"
        >
          <p className="text-sm text-amber-100">
            {staffMissingStandardHours.length} staff member
            {staffMissingStandardHours.length === 1 ? "" : "s"} still need standard hours.
          </p>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F1629]/40">
        <ul className="divide-y divide-white/[0.06]">
          {staffOptions.map((staff) => (
            <li
              key={staff.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              data-testid={`standard-hours-index-staff-${staff.id}`}
            >
              <div>
                <p className="font-medium text-slate-100">{staff.name}</p>
                {staff.role ? (
                  <p className="text-xs capitalize text-slate-500">{staff.role}</p>
                ) : null}
                <p
                  className={cn(
                    "mt-1 text-xs",
                    staff.hasStandardHours ? "text-slate-400" : "text-amber-300/90"
                  )}
                >
                  {staff.hasStandardHours ? "Standard hours configured" : "No standard hours set"}
                </p>
              </div>
              {canManage ? (
                <Link
                  href={buildStaffStandardHoursEditorHref(tenantId, staff.id, { returnTo: rosterHref })}
                  className="rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-950/50"
                  data-testid={`standard-hours-index-link-${staff.id}`}
                >
                  {staff.hasStandardHours ? "Edit standard hours" : "Set standard hours"}
                </Link>
              ) : (
                <span
                  className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-500"
                  title={manageDeniedReason}
                  data-testid={`standard-hours-index-disabled-${staff.id}`}
                >
                  View only
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export type StaffStandardHoursEditorClientProps = {
  tenantId: string;
  staffId: string;
  staffName: string;
  canManage: boolean;
  manageDeniedReason: string;
  initialDays: StaffStandardHoursDayInput[];
  clinics: Array<{ id: string; displayName: string }>;
  rosterCadence: RosterCadence;
  defaultFullTimePattern: DefaultFullTimePattern;
  returnTo?: string | null;
};

export function StaffStandardHoursEditorClient({
  tenantId,
  staffId,
  staffName,
  canManage,
  manageDeniedReason,
  initialDays,
  clinics,
  rosterCadence,
  defaultFullTimePattern,
  returnTo,
}: StaffStandardHoursEditorClientProps) {
  const router = useRouter();
  const rosterHref = buildStaffStandardHoursReturnToRosterHref(tenantId);
  const backHref = returnTo?.trim() || rosterHref;

  function handleSaved() {
    router.push(rosterHref);
    router.refresh();
  }

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "space-y-6 pb-10")}>
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Team</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          {staffName} — Standard hours
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          <Link href={backHref} className="text-cyan-400 hover:text-cyan-300">
            Back
          </Link>
          {" · "}
          <Link
            href={buildStaffStandardHoursReturnToRosterHref(tenantId)}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Roster
          </Link>
        </p>
      </header>

      <StaffHrTaskMapEntryBanner tenantId={tenantId} surface="standard_hours" />

      {!canManage ? (
        <p
          className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100"
          data-testid="standard-hours-manage-denied"
        >
          {manageDeniedReason}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-4 sm:p-5">
        {canManage ? (
          <StaffStandardHoursPanel
            tenantId={tenantId}
            staffId={staffId}
            staffName={staffName}
            initialDays={initialDays}
            clinics={clinics}
            rosterCadence={rosterCadence}
            defaultFullTimePattern={defaultFullTimePattern}
            onSaved={handleSaved}
          />
        ) : (
          <p className="text-sm text-slate-400">
            You can view roster requirements but cannot edit standard hours for this staff member.
          </p>
        )}
      </section>
    </div>
  );
}