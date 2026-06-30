"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { backfillFoundationFromProcessedEventsAction } from "@/lib/actions/fi-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";

/**
 * Optional operator backfill — unchanged behaviour from legacy Foundation integrity panel.
 * FoundationOS remains read-only for data; this action only replays dual-write for a small batch.
 */
export function FoundationOsBackfillCard({
  tenantId,
  variant = "light",
}: {
  tenantId: string;
  variant?: "light" | "darkGlass";
}) {
  const [adminKey, setAdminKey] = useState("");
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const dark = variant === "darkGlass";

  const runBackfill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackfillBusy(true);
    setBackfillMsg(null);
    const res = await backfillFoundationFromProcessedEventsAction(tenantId, adminKey);
    setBackfillBusy(false);
    if (res.ok) {
      setBackfillMsg(
        `Backfill: scanned ${res.scanned}, attempted ${res.attempted}, succeeded ${res.succeeded}, skipped ${res.skipped}, failed ${res.failed}.`,
      );
      if (res.errors.length) setBackfillMsg((m) => `${m} Errors: ${res.errors.join("; ")}`);
    } else {
      setBackfillMsg(res.error);
    }
  };

  const body = (
    <>
      <p className={`mt-2 text-sm leading-relaxed ${dark ? "text-slate-400" : "text-slate-400"}`}>
        Replays dual-write for up to 50 recent <strong className={dark ? "text-slate-200" : "text-slate-200"}>processed</strong> events
        that have no timeline row with matching{" "}
        <code className={`rounded px-1.5 py-0.5 text-xs ${dark ? "bg-white/[0.06] text-cyan-200 ring-1 ring-white/[0.08]" : "bg-[#0F1629]/80 backdrop-blur-md text-cyan-200 ring-1 ring-white/[0.08]"}`}>
          fi_event_id
        </code>
        . Requires server{" "}
        <code className={`rounded px-1.5 py-0.5 text-xs ${dark ? "bg-white/[0.06] text-cyan-200 ring-1 ring-white/[0.08]" : "bg-[#0F1629]/80 backdrop-blur-md text-cyan-200 ring-1 ring-white/[0.08]"}`}>
          FI_ADMIN_API_KEY
        </code>
        . Does not run automatically and does not merge identities.
      </p>
      <form onSubmit={runBackfill} className="mt-4 flex flex-wrap items-end gap-3">
        <label className={`flex min-w-[12rem] flex-1 flex-col text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
          Admin key
          <input
            type="password"
            autoComplete="off"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className={
              dark
                ? "mt-1 w-full max-w-xs rounded-lg border border-white/[0.1] bg-[#0a101f]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
                : "mt-1 w-full max-w-xs rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            }
            placeholder="FI_ADMIN_API_KEY value"
          />
        </label>
        <button
          type="submit"
          disabled={backfillBusy || !adminKey.trim()}
          className={cn(
            dark
              ? cn(fiOsChromeClasses.toolbarControlSurface, "px-4 py-2.5 text-sm font-semibold text-violet-100/95 disabled:opacity-45")
              : "rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-45",
          )}
        >
          {backfillBusy ? "Running…" : "Run batch backfill (max 50)"}
        </button>
      </form>
      {backfillMsg ? <p className={`mt-3 text-sm ${dark ? "text-slate-300" : "text-slate-300"}`}>{backfillMsg}</p> : null}
    </>
  );

  if (dark) {
    return (
      <DashboardCard className="border-violet-500/15 p-4 sm:p-5">
        <SectionHeader
          kicker="Deployment operators"
          title="Manual foundation backfill"
          description="Replay dual-write for processed events missing timeline rows."
        />
        {body}
      </DashboardCard>
    );
  }

  return (
    <FiCard className="border-violet-500/20 bg-violet-500/10">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-violet-300">Deployment operators</p>
      <h2 className="mt-1 text-base font-semibold text-slate-100">Manual foundation backfill</h2>
      {body}
    </FiCard>
  );
}
