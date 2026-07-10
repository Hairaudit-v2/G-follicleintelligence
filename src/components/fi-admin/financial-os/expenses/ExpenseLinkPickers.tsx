"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type {
  ExpenseLinkCaseHit,
  ExpenseLinkLeadHit,
} from "@/src/lib/financialOs/expenses/expenseEntitySearch.server";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type ExpenseLinkSelection = {
  leadId: string | null;
  leadLabel: string | null;
  caseId: string | null;
  caseLabel: string | null;
  campaignKey: string;
};

export function ExpenseLinkPickers(props: {
  tenantId: string;
  disabled?: boolean;
  value: ExpenseLinkSelection;
  onChange: (next: ExpenseLinkSelection) => void;
  campaignSuggestions?: string[];
  compact?: boolean;
}) {
  const tid = props.tenantId.trim();
  const campaignListId = useId();

  return (
    <div className={props.compact ? "grid gap-2 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
      <ExpenseEntitySearchField
        tenantId={tid}
        disabled={props.disabled}
        kind="lead"
        label="Lead"
        selectedId={props.value.leadId}
        selectedLabel={props.value.leadLabel}
        onSelect={(hit) =>
          props.onChange({
            ...props.value,
            leadId: hit.id,
            leadLabel: hit.name ?? null,
          })
        }
        onClear={() =>
          props.onChange({
            ...props.value,
            leadId: null,
            leadLabel: null,
          })
        }
      />
      <ExpenseEntitySearchField
        tenantId={tid}
        disabled={props.disabled}
        kind="case"
        label="Case"
        selectedId={props.value.caseId}
        selectedLabel={props.value.caseLabel}
        onSelect={(hit) =>
          props.onChange({
            ...props.value,
            caseId: hit.id,
            caseLabel: hit.label ?? null,
          })
        }
        onClear={() =>
          props.onChange({
            ...props.value,
            caseId: null,
            caseLabel: null,
          })
        }
      />
      <label className={`${financialOsClasses.formLabel} ${props.compact ? "" : "sm:col-span-2"}`}>
        Campaign key
        <input
          type="text"
          list={campaignListId}
          value={props.value.campaignKey}
          onChange={(e) =>
            props.onChange({ ...props.value, campaignKey: e.target.value })
          }
          className={financialOsClasses.input}
          disabled={props.disabled}
          placeholder="e.g. meta_q3_perth"
          maxLength={200}
        />
        {props.campaignSuggestions && props.campaignSuggestions.length > 0 ? (
          <datalist id={campaignListId}>
            {props.campaignSuggestions.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        ) : null}
      </label>
    </div>
  );
}

function ExpenseEntitySearchField(props: {
  tenantId: string;
  disabled?: boolean;
  kind: "lead" | "case";
  label: string;
  selectedId: string | null;
  selectedLabel: string | null;
  onSelect: (hit: { id: string; name?: string; label?: string }) => void;
  onClear: () => void;
}) {
  const dialogTitleId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<ExpenseLinkLeadHit[]>([]);
  const [cases, setCases] = useState<ExpenseLinkCaseHit[]>([]);

  const fetchHits = useCallback(async () => {
    if (!debounced) {
      setLeads([]);
      setCases([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/tenants/${encodeURIComponent(props.tenantId)}/financial-os/expense-links?q=${encodeURIComponent(debounced)}`;
      const res = await fetch(url, { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        leads?: ExpenseLinkLeadHit[];
        cases?: ExpenseLinkCaseHit[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Search failed.");
      setLeads(json.leads ?? []);
      setCases(json.cases ?? []);
    } catch (e: unknown) {
      setLeads([]);
      setCases([]);
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, [props.tenantId, debounced]);

  useEffect(() => {
    if (!open) return;
    void fetchHits();
  }, [open, fetchHits]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLeads([]);
      setCases([]);
      setError(null);
    }
  }, [open]);

  const hits =
    props.kind === "lead"
      ? leads.map((l) => ({
          id: l.id,
          primary: l.name,
          secondary: l.stageLabel,
        }))
      : cases.map((c) => ({
          id: c.id,
          primary: c.label,
          secondary: c.status,
        }));

  return (
    <div className="space-y-1">
      <p className={financialOsClasses.formLabel}>{props.label}</p>
      <p className="text-sm text-slate-200">
        {props.selectedLabel?.trim() ? (
          props.selectedLabel.trim()
        ) : (
          <span className="text-slate-500">Not linked</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => setOpen(true)}
          className={financialOsClasses.secondaryButton}
        >
          {props.selectedId ? `Change ${props.label.toLowerCase()}` : `Link ${props.label.toLowerCase()}`}
        </button>
        {props.selectedId && !props.disabled ? (
          <button type="button" onClick={props.onClear} className={financialOsClasses.textButton}>
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="max-h-[min(80vh,520px)] w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a101f] shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 id={dialogTitleId} className="text-sm font-semibold text-slate-100">
                Search {props.label.toLowerCase()}s
              </h2>
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-4">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={financialOsClasses.input}
                placeholder={
                  props.kind === "lead"
                    ? "Name, email, phone…"
                    : "Case id, treatment type, external id…"
                }
              />
              {loading ? (
                <p className={financialOsClasses.mutedMeta}>Searching…</p>
              ) : null}
              {error ? <p className={financialOsClasses.errorText}>{error}</p> : null}
              {!loading && debounced && hits.length === 0 && !error ? (
                <p className={financialOsClasses.mutedMeta}>No matches.</p>
              ) : null}
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.05]"
                      onClick={() => {
                        if (props.kind === "lead") {
                          props.onSelect({ id: h.id, name: h.primary });
                        } else {
                          props.onSelect({ id: h.id, label: h.primary });
                        }
                        setOpen(false);
                      }}
                    >
                      <span className="block text-sm font-medium text-slate-100">{h.primary}</span>
                      <span className="block text-xs text-slate-500">
                        {h.secondary} · {h.id.slice(0, 8)}…
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
