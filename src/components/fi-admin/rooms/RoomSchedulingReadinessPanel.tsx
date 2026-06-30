import Link from "next/link";
import { CheckCircle2, AlertTriangle, CircleDashed, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  OverallReadinessStatus,
  RoomSchedulingReadinessCheck,
  RoomSchedulingReadinessResult,
} from "@/src/lib/rooms/roomSchedulingReadinessCore";
import { ClinicBookingSetupTestPanel } from "@/src/components/fi-admin/settings/ClinicBookingSetupTestPanel";

const OVERALL_META: Record<
  OverallReadinessStatus,
  { label: string; cardClass: string; badgeClass: string; Icon: typeof CheckCircle2 }
> = {
  ready: {
    label: "Ready",
    cardClass: "border-emerald-500/30 bg-emerald-950/20",
    badgeClass: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
    Icon: CheckCircle2,
  },
  warning: {
    label: "Needs attention",
    cardClass: "border-amber-500/30 bg-amber-950/20",
    badgeClass: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
    Icon: AlertTriangle,
  },
  needs_setup: {
    label: "Needs setup",
    cardClass: "border-rose-500/30 bg-rose-950/20",
    badgeClass: "bg-rose-500/15 text-rose-100 ring-rose-500/30",
    Icon: XCircle,
  },
};

const CHECK_ICON: Record<RoomSchedulingReadinessCheck["status"], typeof CheckCircle2> = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  fail: XCircle,
};

const CHECK_COLOR: Record<RoomSchedulingReadinessCheck["status"], string> = {
  pass: "text-emerald-400",
  warning: "text-amber-400",
  fail: "text-rose-400",
};

export function RoomSchedulingReadinessPanel({
  tenantId,
  readiness,
  variant = "dark",
  className,
  showBookingSetupTest = true,
}: {
  tenantId: string;
  readiness: RoomSchedulingReadinessResult;
  variant?: "dark" | "light";
  className?: string;
  /** When false, hides the read-only “booking setup test” block. */
  showBookingSetupTest?: boolean;
}) {
  const meta = OVERALL_META[readiness.overallStatus];
  const OverallIcon = meta.Icon;
  const isDark = variant === "dark";

  return (
    <section
      className={cn(
        "rounded-xl border p-4 sm:p-5",
        isDark ? cn("border-white/10 bg-slate-950/50", meta.cardClass) : cn("border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40", meta.cardClass),
        className
      )}
      aria-label="Room and service scheduling readiness"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-500" : "text-gray-500")}>
            Scheduling readiness
          </p>
          <h2 className={cn("mt-1 text-lg font-semibold", isDark ? "text-slate-100" : "text-slate-100")}>
            Room &amp; service checklist
          </h2>
          {readiness.clinicName ? (
            <p className={cn("mt-1 text-sm", isDark ? "text-slate-400" : "text-slate-400")}>
              Clinic: {readiness.clinicName}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
            meta.badgeClass
          )}
        >
          <OverallIcon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {readiness.checks.map((check) => (
          <ReadinessRow key={check.key} check={check} isDark={isDark} />
        ))}
      </ul>

      {showBookingSetupTest && readiness.clinicId ? (
        <div className="mt-4">
          <ClinicBookingSetupTestPanel tenantId={tenantId} clinicId={readiness.clinicId} variant={variant} />
        </div>
      ) : null}

      <PerthDefaultSetupInfoBox isDark={isDark} tenantId={tenantId} />
    </section>
  );
}

function ReadinessRow({ check, isDark }: { check: RoomSchedulingReadinessCheck; isDark: boolean }) {
  const Icon = CHECK_ICON[check.status];
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between",
        isDark ? "border-white/[0.08] bg-black/20" : "border-white/[0.06] bg-white/[0.03]"
      )}
    >
      <div className="flex min-w-0 gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", CHECK_COLOR[check.status])} aria-hidden />
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-slate-100")}>{check.label}</p>
          <p className={cn("mt-0.5 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-400")}>
            {check.message}
          </p>
        </div>
      </div>
      {check.href ? (
        <Link
          href={check.href}
          className={cn(
            "shrink-0 text-xs font-medium hover:underline sm:pt-0.5",
            isDark ? "text-cyan-400" : "text-cyan-300"
          )}
        >
          {check.actionLabel ?? "Open"}
        </Link>
      ) : null}
    </li>
  );
}

function PerthDefaultSetupInfoBox({ isDark, tenantId }: { isDark: boolean; tenantId: string }) {
  const calendarHref = `/fi-admin/${tenantId.trim()}/calendar?view=day&resourceView=room`;
  return (
    <div
      className={cn(
        "mt-4 rounded-lg border px-3 py-3 text-xs leading-relaxed",
        isDark ? "border-cyan-500/20 bg-cyan-950/15 text-slate-300" : "border-cyan-500/20 bg-cyan-500/10 text-slate-300"
      )}
    >
      <p className={cn("font-semibold", isDark ? "text-cyan-100" : "text-cyan-200")}>Perth default setup</p>
      <ul className="mt-2 list-inside list-disc space-y-0.5">
        <li>Consult Room 1</li>
        <li>Consult Room 2 / Patient Room 2 — shared physical room</li>
        <li>PRP Room 1</li>
        <li>PRP Room 2 / Surgery 2 — shared physical room</li>
        <li>Surgery 1</li>
        <li>Surgery 2</li>
        <li>Patient Room 1</li>
      </ul>
      <p className="mt-3">
        Seed default service mappings:{" "}
        <code className={cn("rounded px-1 py-0.5 font-mono text-[11px]", isDark ? "bg-black/30" : "bg-[#0F1629]/80 backdrop-blur-md")}>
          npm run seed -- --dry-run
        </code>{" "}
        then{" "}
        <code className={cn("rounded px-1 py-0.5 font-mono text-[11px]", isDark ? "bg-black/30" : "bg-[#0F1629]/80 backdrop-blur-md")}>
          npm run seed
        </code>
      </p>
      <p className="mt-2">
        <Link href={calendarHref} className={cn("font-medium hover:underline", isDark ? "text-cyan-400" : "text-cyan-300")}>
          View calendar by room
        </Link>
        {" · "}
        <Link
          href={`/fi-admin/${tenantId.trim()}/rooms`}
          className={cn("font-medium hover:underline", isDark ? "text-cyan-400" : "text-cyan-300")}
        >
          Manage rooms
        </Link>
        {" · "}
        <Link
          href={`/fi-admin/${tenantId.trim()}/services`}
          className={cn("font-medium hover:underline", isDark ? "text-cyan-400" : "text-cyan-300")}
        >
          Edit services
        </Link>
      </p>
    </div>
  );
}

export function RoomSchedulingReadinessCompactBadge({ status }: { status: OverallReadinessStatus }) {
  const meta = OVERALL_META[status];
  const Icon = meta.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", meta.badgeClass)}>
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

export function RoomSchedulingReadinessEmptyState() {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500">
      <CircleDashed className="h-4 w-4" aria-hidden />
      Readiness checks unavailable — no clinic configured.
    </p>
  );
}
