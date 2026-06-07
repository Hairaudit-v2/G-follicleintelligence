"use client";

import { useState } from "react";
import { backfillFoundationFromProcessedEventsAction } from "@/lib/actions/fi-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";

/**
 * Optional operator backfill — unchanged behaviour from legacy Foundation integrity panel.
 * FoundationOS remains read-only for data; this action only replays dual-write for a small batch.
 */
export function FoundationOsBackfillCard({ tenantId }: { tenantId: string }) {
  const [adminKey, setAdminKey] = useState("");
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

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

  return (
    <FiCard className="border-violet-200 bg-violet-50/40">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-violet-800/90">Deployment operators</p>
      <h2 className="mt-1 text-base font-semibold text-slate-900">Manual foundation backfill</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Replays dual-write for up to 50 recent <strong className="text-slate-800">processed</strong> events that have no timeline row with matching{" "}
        <code className="rounded bg-white px-1.5 py-0.5 text-xs text-sky-800 ring-1 ring-slate-200">fi_event_id</code>. Requires server{" "}
        <code className="rounded bg-white px-1.5 py-0.5 text-xs text-sky-800 ring-1 ring-slate-200">FI_ADMIN_API_KEY</code>. Does not run automatically and does not merge identities.
      </p>
      <form onSubmit={runBackfill} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col text-xs text-slate-600">
          Admin key
          <input
            type="password"
            autoComplete="off"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            placeholder="FI_ADMIN_API_KEY value"
          />
        </label>
        <button
          type="submit"
          disabled={backfillBusy || !adminKey.trim()}
          className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-45"
        >
          {backfillBusy ? "Running…" : "Run batch backfill (max 50)"}
        </button>
      </form>
      {backfillMsg ? <p className="mt-3 text-sm text-slate-700">{backfillMsg}</p> : null}
    </FiCard>
  );
}
