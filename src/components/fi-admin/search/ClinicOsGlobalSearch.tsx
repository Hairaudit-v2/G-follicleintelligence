"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowRight, Briefcase, LineChart, Loader2, Search, User, X } from "lucide-react";
import type { ClinicOsGlobalSearchPayload } from "@/src/lib/fiAdmin/clinicOsGlobalSearchTypes";
import { FiCaseCard } from "@/src/components/fi-design/FiCaseCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiLeadCard } from "@/src/components/fi-design/FiLeadCard";
import { FiPatientCard } from "@/src/components/fi-design/FiPatientCard";

const RECENT_PLACEHOLDERS = [
  { name: "Amelia Chen", meta: "Last visit · preview" },
  { name: "James Patel", meta: "Follow-up · preview" },
  { name: "Sofia Martins", meta: "Consultation · preview" },
];

const CLINIC_OS_SEARCH_DIALOG_TITLE_ID = "clinic-os-global-search-title";
const CLINIC_OS_SEARCH_RESULTS_ID = "clinic-os-global-search-results";
const CLINIC_OS_SEARCH_PATIENTS_HEADING_ID = "clinic-os-global-search-patients-heading";
const CLINIC_OS_SEARCH_CASES_HEADING_ID = "clinic-os-global-search-cases-heading";
const CLINIC_OS_SEARCH_LEADS_HEADING_ID = "clinic-os-global-search-leads-heading";

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

type ClinicOsGlobalSearchProps = {
  tenantId: string;
  base: string;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ClinicOsGlobalSearch({
  tenantId,
  base,
  showCrmNav,
  showBookingsBoard = showCrmNav,
  open,
  onOpenChange,
}: ClinicOsGlobalSearchProps) {
  const tid = tenantId.trim();
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 280);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClinicOsGlobalSearchPayload | null>(null);

  const debouncedTrim = debouncedQuery.trim();

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!debouncedTrim) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const baseUrl = `/api/tenants/${encodeURIComponent(tid)}/clinic-os/global-search`;
    const qParam = `q=${encodeURIComponent(debouncedTrim)}`;

    fetch(`${baseUrl}?${qParam}`, { credentials: "same-origin" })
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          code?: string;
        } & Partial<ClinicOsGlobalSearchPayload>;
        if (!res.ok || !json.ok) {
          if (res.status >= 500) {
            throw new Error(
              json.error?.trim() || "Search could not be completed. Please try again."
            );
          }
          throw new Error(json.error?.trim() || "Search failed.");
        }
        return json as { ok: true } & ClinicOsGlobalSearchPayload;
      })
      .then((json) => {
        if (cancelled) return;
        setData({
          patients: json.patients ?? [],
          cases: json.cases ?? [],
          leads: [],
        });
        if (!showCrmNav) return;
        fetch(`${baseUrl}?${qParam}&scope=leads`, { credentials: "same-origin" })
          .then(async (res) => {
            const leadJson = (await res.json()) as {
              ok?: boolean;
              leads?: ClinicOsGlobalSearchPayload["leads"];
            };
            if (!res.ok || !leadJson.ok || cancelled) return;
            setData((prev) =>
              prev
                ? { ...prev, leads: leadJson.leads ?? [] }
                : { patients: [], cases: [], leads: leadJson.leads ?? [] }
            );
          })
          .catch(() => {
            /* leads are optional enrichment — first pass already painted */
          });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Search failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tid, debouncedTrim]);

  useEffect(() => {
    if (!open) return;

    function collectFocusables(): HTMLElement[] {
      const root = panelRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }

      if (e.key !== "Tab") return;
      const nodes = collectFocusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) return;
    const el = lastActiveRef.current;
    if (el && typeof el.focus === "function") {
      window.requestAnimationFrame(() => el.focus());
    }
    lastActiveRef.current = null;
  }, [open]);

  const flatResultHrefs = useMemo(() => {
    if (!data) return [] as { href: string; key: string }[];
    const out: { href: string; key: string }[] = [];
    for (const p of data.patients) out.push({ href: p.href, key: `p-${p.id}` });
    for (const c of data.cases) out.push({ href: c.href, key: `c-${c.id}` });
    for (const l of data.leads) out.push({ href: l.href, key: `l-${l.id}` });
    return out;
  }, [data]);

  const onResultsKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const links = flatResultHrefs
        .map(({ key }) =>
          panelRef.current?.querySelector<HTMLElement>(`[data-result-key="${key}"]`)
        )
        .filter(Boolean) as HTMLElement[];
      if (links.length === 0) return;
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const idx = links.findIndex((n) => n === active);
      const next =
        e.key === "ArrowDown"
          ? links[Math.min(links.length - 1, idx < 0 ? 0 : idx + 1)]
          : links[Math.max(0, idx <= 0 ? 0 : idx - 1)];
      next?.focus();
    },
    [flatResultHrefs]
  );

  const onBackdropClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  const newPatientHref = `${base}/patients/new`;
  const newBookingHref = `${base}/bookings/new`;
  const newLeadHref = `${base}/crm`;
  const newCaseHref = `${base}/cases/new`;

  const hasResults =
    data && (data.patients.length > 0 || data.cases.length > 0 || data.leads.length > 0);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/45 px-3 py-10 backdrop-blur-[2px] sm:px-4 sm:py-14"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onBackdropClick();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={CLINIC_OS_SEARCH_DIALOG_TITLE_ID}
        className="flex max-h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-[0_24px_80px_-12px_rgba(15,23,42,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2
                id={CLINIC_OS_SEARCH_DIALOG_TITLE_ID}
                className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl"
              >
                Search patients, leads, bookings and cases
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Read-only search · no changes are made from this panel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 outline-none transition hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400/40"
              aria-label="Close search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="relative mt-4">
            <label
              id="clinic-os-global-search-label"
              htmlFor="clinic-os-global-search-query"
              className="sr-only"
            >
              Search patients or commands
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              ref={searchInputRef}
              id="clinic-os-global-search-query"
              name="clinic-os-global-search-query"
              type="search"
              role="combobox"
              aria-labelledby="clinic-os-global-search-label"
              aria-autocomplete="list"
              aria-expanded={Boolean(debouncedTrim)}
              aria-controls={debouncedTrim ? CLINIC_OS_SEARCH_RESULTS_ID : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown") return;
                if (!data || flatResultHrefs.length === 0) return;
                const first = panelRef.current?.querySelector<HTMLElement>(
                  `[data-result-key="${flatResultHrefs[0].key}"]`
                );
                if (first) {
                  e.preventDefault();
                  first.focus();
                }
              }}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Name, phone, email or patient number"
              className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-11 pr-4 text-base text-slate-100 outline-none ring-sky-500/20 transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-[#0F1629]/80 backdrop-blur-md focus:ring-4 sm:h-14 sm:text-lg"
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            id={CLINIC_OS_SEARCH_RESULTS_ID}
            {...(hasResults ? ({ role: "listbox", "aria-label": "Search results" } as const) : {})}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:max-w-none"
            onKeyDown={onResultsKeyDown}
          >
            {!debouncedTrim ? (
              <FiEmptyState
                title="Start typing"
                description="Search across patients, clinical records, and leads you have access to."
              />
            ) : loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300" aria-hidden />
                <span className="text-sm">Searching…</span>
              </div>
            ) : error ? (
              <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            ) : !hasResults ? (
              <FiEmptyState
                title="No matches"
                description="Try a different name, phone, email, or patient reference."
              />
            ) : (
              <div className="space-y-8">
                {data!.patients.length > 0 ? (
                  <section aria-labelledby={CLINIC_OS_SEARCH_PATIENTS_HEADING_ID}>
                    <h3
                      id={CLINIC_OS_SEARCH_PATIENTS_HEADING_ID}
                      className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <User className="h-3.5 w-3.5" aria-hidden />
                      PatientOS
                    </h3>
                    <ul className="space-y-1.5">
                      {data!.patients.map((p) => (
                        <li key={p.id}>
                          <FiPatientCard
                            dataResultKey={`p-${p.id}`}
                            name={p.name}
                            phone={p.phone}
                            email={p.email}
                            href={p.href}
                            onNavigate={() => onOpenChange(false)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {data!.cases.length > 0 ? (
                  <section aria-labelledby={CLINIC_OS_SEARCH_CASES_HEADING_ID}>
                    <h3
                      id={CLINIC_OS_SEARCH_CASES_HEADING_ID}
                      className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <Briefcase className="h-3.5 w-3.5" aria-hidden />
                      SurgeryOS
                    </h3>
                    <ul className="space-y-1.5">
                      {data!.cases.map((c) => (
                        <li key={c.id}>
                          <FiCaseCard
                            dataResultKey={`c-${c.id}`}
                            title={c.caseNumber}
                            patientName={c.patientName}
                            status={c.status}
                            href={c.href}
                            onNavigate={() => onOpenChange(false)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {data!.leads.length > 0 ? (
                  <section aria-labelledby={CLINIC_OS_SEARCH_LEADS_HEADING_ID}>
                    <h3
                      id={CLINIC_OS_SEARCH_LEADS_HEADING_ID}
                      className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <LineChart className="h-3.5 w-3.5" aria-hidden />
                      LeadFlow
                    </h3>
                    <ul className="space-y-1.5">
                      {data!.leads.map((l) => (
                        <li key={l.id}>
                          <FiLeadCard
                            dataResultKey={`l-${l.id}`}
                            name={l.name}
                            stage={l.stageLabel}
                            href={l.href}
                            onNavigate={() => onOpenChange(false)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            )}
          </div>

          <aside className="shrink-0 border-t border-white/[0.06] bg-white/[0.03] px-4 py-4 sm:px-5 lg:w-56 lg:border-l lg:border-t-0 lg:py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick actions
            </p>
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  href={newPatientHref}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200 outline-none transition hover:bg-[#0F1629]/80 backdrop-blur-md hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400/40"
                >
                  New Patient
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                </Link>
              </li>
              <li>
                {showBookingsBoard ? (
                  <Link
                    href={newBookingHref}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200 outline-none transition hover:bg-[#0F1629]/80 backdrop-blur-md hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400/40"
                  >
                    New Booking
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </Link>
                ) : (
                  <span
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-400"
                    title="Requires scheduling access (admin/CRM operator or active staff link)"
                  >
                    New Booking
                  </span>
                )}
              </li>
              <li>
                {showCrmNav ? (
                  <Link
                    href={newLeadHref}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200 outline-none transition hover:bg-[#0F1629]/80 backdrop-blur-md hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400/40"
                  >
                    New enquiry
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </Link>
                ) : (
                  <span
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-400"
                    title="Requires CRM workspace access"
                  >
                    New enquiry
                  </span>
                )}
              </li>
              <li>
                <Link
                  href={newCaseHref}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200 outline-none transition hover:bg-[#0F1629]/80 backdrop-blur-md hover:shadow-sm focus-visible:ring-2 focus-visible:ring-sky-400/40"
                >
                  New case
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                </Link>
              </li>
            </ul>
          </aside>
        </div>

        <footer className="shrink-0 border-t border-white/[0.06] bg-white/[0.03] px-4 py-3 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent patients
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Preview · not connected to live data</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {RECENT_PLACEHOLDERS.map((row) => (
              <li
                key={row.name}
                className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-1.5 text-xs text-slate-400 shadow-lg shadow-black/40"
              >
                <span className="font-medium text-slate-200">{row.name}</span>
                <span className="ml-2 text-slate-400">{row.meta}</span>
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </div>
  );
}
