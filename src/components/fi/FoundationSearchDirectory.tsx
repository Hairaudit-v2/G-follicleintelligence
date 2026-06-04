"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { FoundationSearchFilter, FoundationSearchGroupedResult, FoundationSearchHit } from "@/src/lib/fi/foundation/search";

const FILTERS: { value: FoundationSearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "patients", label: "Patients" },
  { value: "cases", label: "Cases" },
  { value: "clinics", label: "Clinics" },
  { value: "organisations", label: "Organisations" },
];

function buildDirectoryHref(tenantId: string, q: string, filter: FoundationSearchFilter): string {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (filter !== "all") p.set("type", filter);
  const qs = p.toString();
  return `/fi-admin/${tenantId}/directory${qs ? `?${qs}` : ""}`;
}

function HitRow({ hit }: { hit: FoundationSearchHit }) {
  const isCard = hit.type === "clinic" || hit.type === "organisation";
  const inner = (
    <div className="rounded border border-gray-200 bg-white p-3 text-sm hover:border-gray-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-gray-900">{hit.title}</div>
          <div className="mt-0.5 text-xs text-gray-600">{hit.subtitle}</div>
          {hit.source_system && (
            <div className="mt-1 text-xs text-gray-500">
              Source: <span className="font-mono">{hit.source_system}</span>
            </div>
          )}
        </div>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">{hit.type}</span>
      </div>
      {hit.warning && <p className="mt-2 text-xs text-amber-800">{hit.warning}</p>}
      {!isCard && (
        <p className="mt-2">
          <Link href={hit.href} className="text-xs font-medium text-blue-700 hover:underline">
            Open record →
          </Link>
        </p>
      )}
    </div>
  );

  if (isCard) {
    return (
      <div id={hit.type === "clinic" ? `clinic-${hit.id}` : `organisation-${hit.id}`}>
        <a href={hit.href} className="block text-inherit no-underline">
          {inner}
        </a>
      </div>
    );
  }

  return <div>{inner}</div>;
}

function Group({
  title,
  hits,
  empty,
}: {
  title: string;
  hits: FoundationSearchHit[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-900">
        {title} <span className="font-normal text-gray-500">({hits.length})</span>
      </h2>
      {hits.length === 0 ? (
        <p className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">{empty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-1 md:grid-cols-2">
          {hits.map((hit) => (
            <li key={`${hit.type}-${hit.id}`}>
              <HitRow hit={hit} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FoundationSearchDirectory({
  tenantId,
  result,
  organisationCount,
  clinicCount,
}: {
  tenantId: string;
  result: FoundationSearchGroupedResult;
  organisationCount: number;
  clinicCount: number;
}) {
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash || hash.length < 2) return;
    const id = hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [result.tenant_id, result.query, result.filter, qFromUrl]);

  const total =
    result.patients.length + result.cases.length + result.clinics.length + result.organisations.length;
  const noMatches = total === 0 && Boolean(result.query?.trim());
  const noData = total === 0 && !result.query?.trim();

  return (
    <div className="space-y-8 text-sm">
      <form action={`/fi-admin/${tenantId}/directory`} method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col text-xs text-gray-600">
          Search
          <input
            type="search"
            name="q"
            defaultValue={result.query ?? ""}
            placeholder="Name, email, id, source id…"
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Scope
          <select
            name="type"
            defaultValue={result.filter}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800"
        >
          Search
        </button>
      </form>

      <nav className="flex flex-wrap gap-2 text-xs">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildDirectoryHref(tenantId, qFromUrl, f.value)}
            className={`rounded border px-2 py-1 no-underline ${
              result.filter === f.value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {noMatches ? (
        <p className="rounded border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
          No matches for this query in the selected scope. Try a different term, clear the search to browse recent
          records, or widen scope to &quot;All&quot;.
        </p>
      ) : noData ? (
        <div className="space-y-3 rounded border border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <p className="text-sm text-gray-600">
            No foundation directory rows returned for this tenant yet. Ingest data and search again, or use{" "}
            <a className="font-medium text-blue-700 underline" href="#foundation-tools">
              foundation tools
            </a>{" "}
            above to create organisations and clinics.
          </p>
          {organisationCount === 0 && clinicCount === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="#foundation-tools"
                className="inline-flex rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white no-underline hover:bg-gray-800"
              >
                Create organisation
              </a>
              <span className="text-xs text-gray-500">Then create a clinic in the same panel.</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {total > 0 && (
        <>
      {(result.filter === "all" || result.filter === "patients") && (
        <Group
          title="Patients"
          hits={result.patients}
          empty="No patient rows in this scope."
        />
      )}
      {(result.filter === "all" || result.filter === "cases") && (
        <Group title="Cases" hits={result.cases} empty="No cases in this scope." />
      )}
      {(result.filter === "all" || result.filter === "clinics") && (
        <Group title="Clinics" hits={result.clinics} empty="No clinics in this scope." />
      )}
      {(result.filter === "all" || result.filter === "organisations") && (
        <Group
          title="Organisations"
          hits={result.organisations}
          empty="No organisations in this scope."
        />
      )}
        </>
      )}
    </div>
  );
}
