"use client";

import { Activity, Mail, MessageSquare, Moon, RefreshCw, ShieldCheck } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  providerModeLabel,
  type ReceptionOsSystemStatus,
} from "@/src/lib/receptionOs/receptionOsPilotStatusModel";

function boolBadge(on: boolean, onLabel: string, offLabel: string): string {
  return on ? onLabel : offLabel;
}

export function ReceptionOsSystemStatusPanel({
  status,
  clientLastRefreshedAt,
}: {
  status: ReceptionOsSystemStatus;
  clientLastRefreshedAt: Date | null;
}) {
  const refreshLabel = clientLastRefreshedAt
    ? clientLastRefreshedAt.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <DashboardCard
      className={cn(
        "overflow-hidden",
        status.pilotModeActive ? "border-amber-500/25" : "border-emerald-500/25",
      )}
    >
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="System status"
          description="ReceptionOS pilot / communication readiness"
        />
      </div>
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusMetric
          icon={ShieldCheck}
          label="Dry-run"
          value={boolBadge(status.dryRunEnabled, "On", "Off")}
          tone={status.dryRunEnabled ? "warning" : "success"}
        />
        <StatusMetric
          icon={Mail}
          label="Email live"
          value={boolBadge(status.emailSendEnabled, "Enabled", "Disabled")}
          tone={status.emailSendEnabled ? "info" : "muted"}
        />
        <StatusMetric
          icon={MessageSquare}
          label="SMS live"
          value={boolBadge(status.smsSendEnabled, "Enabled", "Disabled")}
          tone={status.smsSendEnabled ? "info" : "muted"}
        />
        <StatusMetric
          icon={Activity}
          label="Provider"
          value={providerModeLabel(status.providerMode)}
          tone={status.pilotModeActive ? "warning" : "success"}
        />
      </div>
      <div className="grid gap-3 border-t border-white/[0.06] px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusMetric
          icon={RefreshCw}
          label="Last refresh"
          value={refreshLabel}
          hint={`Payload loaded ${new Date(status.lastPayloadLoadedAt).toLocaleTimeString()}`}
          tone="muted"
        />
        <StatusMetric
          icon={MessageSquare}
          label="Failed sends today"
          value={String(status.failedSendsToday)}
          tone={status.failedSendsToday > 0 ? "danger" : "success"}
        />
        <StatusMetric
          icon={Moon}
          label="Closeout"
          value={status.closeoutStatus === "closed" ? "Day closed" : "Open"}
          hint={status.closeoutOperatingDate}
          tone={status.closeoutStatus === "closed" ? "success" : "warning"}
        />
        <StatusMetric
          icon={ShieldCheck}
          label="Pilot mode"
          value={status.pilotModeActive ? "Active" : "Off"}
          tone={status.pilotModeActive ? "warning" : "success"}
        />
      </div>
      <div className="border-t border-white/[0.06] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Environment checklist</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {status.envChecklist.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm text-slate-400">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  item.present ? "bg-emerald-400" : "bg-slate-600",
                )}
                aria-hidden
              />
              <span>{item.label}</span>
              {item.optional ? <span className="text-xs text-slate-600">(optional)</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "muted",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "danger" | "info" | "muted";
}) {
  const valueTone =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "danger"
          ? "text-rose-300"
          : tone === "info"
            ? "text-cyan-300"
            : "text-slate-100";

  return (
    <div className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-2.5")}>
      <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className={cn("mt-1 text-sm font-semibold", valueTone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
