"use client";

/**
 * FI-PATIENT-APP-2F.3 — staff thread panel over canonical gateway messages.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FrontDeskPatientMessageThreadDetail } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore";

export type FrontDeskPatientMessageThreadPanelProps = {
  tenantId: string;
  threadId: string;
  onClose: () => void;
  onChanged?: () => void;
};

export function FrontDeskPatientMessageThreadPanel({
  tenantId,
  threadId,
  onClose,
  onChanged,
}: FrontDeskPatientMessageThreadPanelProps) {
  const [detail, setDetail] = useState<FrontDeskPatientMessageThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/front-desk/patient-messages/${encodeURIComponent(threadId)}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!res.ok) throw new Error(`Could not open thread (${res.status})`);
      const json = (await res.json()) as { data?: FrontDeskPatientMessageThreadDetail };
      if (!json.data) throw new Error("Thread missing.");
      setDetail(json.data);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load thread.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, threadId, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendReply = async () => {
    if (!detail?.canReply || busy) return;
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/front-desk/patient-messages/${encodeURIComponent(threadId)}/reply`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `Reply failed (${res.status})`);
      }
      setReply("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply failed.");
    } finally {
      setBusy(false);
    }
  };

  const markHandled = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/front-desk/patient-messages/${encodeURIComponent(threadId)}/handle`,
        { method: "POST", credentials: "same-origin" }
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `Handle failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark handled.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Patient message thread"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close thread panel"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0B1220] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">
              {detail?.patientDisplayName ?? "Patient message"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {detail
                ? `${detail.categoryLabel} · ${detail.workState}`
                : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading && !detail ? (
            <p className="text-sm text-slate-400">Loading thread…</p>
          ) : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {detail?.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                m.direction === "patient_to_clinic"
                  ? "bg-white/[0.04] text-slate-200"
                  : "bg-[#22C1FF]/10 text-slate-100"
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {m.senderLabel}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {new Date(m.sentAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <footer className="space-y-2 border-t border-white/[0.08] px-4 py-3">
          {detail ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={detail.patientHref}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
              >
                Open patient profile
              </Link>
              {detail.workState !== "handled" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void markHandled()}
                  className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  Mark handled
                </button>
              ) : (
                <span className="rounded-lg border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-400/80">
                  Handled
                </span>
              )}
            </div>
          ) : null}

          {detail?.canReply ? (
            <div className="space-y-2">
              <label className="sr-only" htmlFor="fd-patient-msg-reply">
                Reply to patient
              </label>
              <textarea
                id="fd-patient-msg-reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Reply to patient…"
                className="w-full resize-none rounded-lg border border-white/10 bg-[#0F1629] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#22C1FF]/40 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !reply.trim()}
                onClick={() => void sendReply()}
                className="w-full rounded-lg bg-[#22C1FF]/20 px-3 py-2 text-sm font-medium text-[#22C1FF] hover:bg-[#22C1FF]/30 disabled:opacity-40"
              >
                Send reply
              </button>
            </div>
          ) : detail && !detail.canReply ? (
            <p className="text-xs text-slate-500">
              Reply requires edit access, or this thread is closed.
            </p>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}
