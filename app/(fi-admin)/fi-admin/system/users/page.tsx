"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export default function SystemUsersImpersonationPage() {
  const router = useRouter();
  const [targetAuthUserId, setTarget] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/fi-os/impersonation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAuthUserId: targetAuthUserId.trim(),
          tenantId: tenantId.trim() || undefined,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setMsg(j.error ?? `Request failed (${r.status})`);
        return;
      }
      setMsg("Impersonation started. Open a tenant workspace to continue.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setMsg(null);
    setBusy(true);
    try {
      await fetch("/api/fi-os/impersonation/stop", { method: "POST" });
      router.refresh();
      setMsg("Impersonation ended.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Security</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">User impersonation</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          <strong className="text-slate-200">Act as user</strong> sets an httpOnly cookie so tenant checks use the target
          identity while your Supabase session remains the platform administrator. Sessions are written to{" "}
          <code className="text-xs text-slate-300">fi_os_impersonation_sessions</code> with initiator, target, IP, user-agent,
          optional tenant, and timestamps.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-100">Act as user</h2>
        <label className="mt-3 block text-xs font-medium text-slate-500">
          Target auth user id (UUID)
          <input
            value={targetAuthUserId}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/40"
            placeholder="00000000-0000-0000-0000-000000000000"
            autoComplete="off"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-slate-500">
          Optional tenant context (UUID)
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/40"
            placeholder="Recorded on the audit row only"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={busy || !targetAuthUserId.trim()}
          onClick={() => void start()}
          className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
        >
          Act as user
        </button>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-100">Exit impersonation</h2>
        <p className="mt-1 text-xs text-slate-500">Clears the impersonation cookie and closes open audit rows for your session.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void stop()}
          className="mt-4 rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1] disabled:opacity-40"
        >
          Exit impersonation
        </button>
      </div>

      {msg ? <p className="text-sm text-amber-200">{msg}</p> : null}
    </div>
  );
}
