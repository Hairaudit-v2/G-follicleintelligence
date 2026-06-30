"use client";

import { useCallback, useEffect, useId, useState } from "react";

import type { ConsultationLinkSearchLeadHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type ConsultationLeadLinkFieldProps = {
  tenantId: string;
  disabled?: boolean;
  leadId: string | null;
  leadLabel: string | null;
  leadStage: string | null;
  onLinkLead: (hit: ConsultationLinkSearchLeadHit) => void;
  onClearLead: () => void;
};

export function ConsultationLeadLinkField({
  tenantId,
  disabled,
  leadId,
  leadLabel,
  leadStage,
  onLinkLead,
  onClearLead,
}: ConsultationLeadLinkFieldProps) {
  const tid = tenantId.trim();
  const dialogTitleId = useId();
  const searchLabelId = useId();
  const searchInputId = useId();
  const searchHintId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 320);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<ConsultationLinkSearchLeadHit[]>([]);

  const fetchHits = useCallback(async () => {
    if (!debounced) {
      setHits([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/tenants/${encodeURIComponent(tid)}/consultations/search-links?q=${encodeURIComponent(debounced)}`;
      const res = await fetch(url, { credentials: "same-origin" });
      const json = (await res.json()) as { ok?: boolean; error?: string; leads?: ConsultationLinkSearchLeadHit[] };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Search failed.");
      }
      setHits(json.leads ?? []);
    } catch (e: unknown) {
      setHits([]);
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, [tid, debounced]);

  useEffect(() => {
    if (!open) return;
    void fetchHits();
  }, [open, fetchHits]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead</p>
      <p className="text-sm font-medium text-slate-100">
        {leadLabel?.trim() ? (
          <>
            {leadLabel.trim()}
            {leadStage?.trim() ? (
              <span className="mt-0.5 block text-xs font-normal text-slate-500">{leadStage.trim()}</span>
            ) : null}
          </>
        ) : (
          "No lead linked"
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="inline-flex items-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Link lead
        </button>
        {leadId && !disabled ? (
          <button
            type="button"
            onClick={onClearLead}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-200"
          >
            Remove link
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 sm:pt-24"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="max-h-[min(80vh,560px)] w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 id={dialogTitleId} className="text-sm font-semibold text-slate-100">
                Search leads
              </h2>
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 p-4">
              <label htmlFor={searchInputId} id={searchLabelId} className="block text-sm font-medium text-slate-200">
                Lead search
              </label>
              <p id={searchHintId} className="text-xs text-slate-500">
                Search by lead name, phone, or email. Read-only.
              </p>
              <input
                id={searchInputId}
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-describedby={searchHintId}
                placeholder="Search…"
                className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm outline-none ring-sky-400/20 focus:border-sky-300 focus:ring-2"
              />
              {loading ? <p className="text-xs text-slate-500">Searching…</p> : null}
              {error ? <p className="text-xs text-rose-300">{error}</p> : null}
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col rounded-lg border border-transparent px-2 py-2 text-left text-sm hover:border-white/[0.08] hover:bg-white/[0.03]"
                      onClick={() => {
                        onLinkLead(h);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-slate-100">{h.name}</span>
                      <span className="text-xs text-slate-500">
                        {h.stageLabel}
                        {h.phone || h.email ? ` · ${[h.phone, h.email].filter(Boolean).join(" · ")}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!loading && debounced && hits.length === 0 && !error ? (
                <p className="text-xs text-slate-500">No matches.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
