"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function PrescriptionPatientPickerClient({
  tenantId,
  caseId,
}: {
  tenantId: string;
  caseId: string | null;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const router = useRouter();
  const searchHintId = useId();
  const searchInputId = useId();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 320);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<ConsultationLinkSearchPatientHit[]>([]);

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
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        patients?: ConsultationLinkSearchPatientHit[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Search failed.");
      }
      setHits(json.patients ?? []);
    } catch (e: unknown) {
      setHits([]);
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, [tid, debounced]);

  useEffect(() => {
    void fetchHits();
  }, [fetchHits]);

  function selectPatient(hit: ConsultationLinkSearchPatientHit) {
    const params = new URLSearchParams({ patientId: hit.id });
    if (caseId) params.set("caseId", caseId);
    router.push(`${base}/prescriptions/new?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <p className="text-xs text-slate-400">
        <Link href={`${base}/prescriptions`} className="text-cyan-300 hover:underline">
          Prescriptions workspace
        </Link>
      </p>

      <FiCard>
        <FiPageHeader
          titleId="rx-patient-picker-heading"
          eyebrow="DoctorOS"
          title="New prescription"
          description="Search for a patient to start composing a prescription."
        />
      </FiCard>

      <FiCard>
        <label htmlFor={searchInputId} className="block text-sm font-medium text-slate-200">
          Patient search
        </label>
        <p id={searchHintId} className="mt-1 text-xs text-slate-500">
          Search by name, phone, or email.
        </p>
        <input
          id={searchInputId}
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={searchHintId}
          placeholder="Search patients…"
          className="mt-3 w-full rounded-lg border border-white/[0.08] bg-[#0c1220]/60 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-400/20 focus:border-emerald-300/50 focus:ring-2"
        />
        {loading ? <p className="mt-3 text-xs text-slate-500">Searching…</p> : null}
        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition hover:border-emerald-400/25 hover:bg-white/[0.03]"
                onClick={() => selectPatient(h)}
              >
                <span className="font-medium text-slate-100">{h.name}</span>
                <span className="text-xs text-slate-500">
                  {[h.phone, h.email].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!loading && debounced && hits.length === 0 && !error ? (
          <p className="mt-3 text-xs text-slate-500">No matches.</p>
        ) : null}
        {!debounced ? (
          <p className="mt-3 text-xs text-slate-500">Type at least one character to search.</p>
        ) : null}
      </FiCard>
    </div>
  );
}
