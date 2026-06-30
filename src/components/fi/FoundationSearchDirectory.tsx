"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { FoundationSearchFilter, FoundationSearchGroupedResult, FoundationSearchHit } from "@/src/lib/fi/foundation/search";

const FILTERS: { value: FoundationSearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "patients", label: "Patients" },
  { value: "cases", label: "Clinical patients" },
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
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 text-sm hover:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-100">{hit.title}</div>
          <div className="mt-0.5 text-xs text-slate-400">{hit.subtitle}</div>
          {hit.source_system && (
            <div className="mt-1 text-xs text-gray-500">
              Source: <span className="font-mono">{hit.source_system}</span>
            </div>
          )}
        </div>
        <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs capitalize text-slate-300">{hit.type}</span>
      </div>
      {hit.warning && <p className="mt-2 text-xs text-amber-300">{hit.warning}</p>}
      {!isCard && (
        <p className="mt-2">
          <Link href={hit.href} className="text-xs font-medium text-blue-300 hover:underline">
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
      <h2 className="text-sm font-semibold text-[#F8FAFC] sm:text-base">
        {title} <span className="font-normal text-[#64748B]">({hits.length})</span>
      </h2>
      {hits.length === 0 ? (
        <DashboardCard className="border-dashed border-white/[0.1] bg-[#0F1629]/60 px-3 py-4 text-sm text-[#94A3B8]">
          {empty}
        </DashboardCard>
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
        <label className="flex min-w-[200px] flex-1 flex-col text-xs text-slate-400">
          Search
          <input
            type="search"
            name="q"
            defaultValue={result.query ?? ""}
            placeholder="Name, email, id, source id…"
            className="mt-1 rounded border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Scope
          <select
            name="type"
            defaultValue={result.filter}
            className="mt-1 rounded border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
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
              result.filter === f.value ? "border-gray-900 bg-gray-900 text-white" : "border-white/[0.08] text-slate-300 hover:bg-white/[0.03]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {noMatches ? (
        <DashboardCard className="border-dashed border-white/[0.12] p-6 text-center">
          <p className="text-base leading-relaxed text-[#94A3B8]">
            No matches for this query in the selected scope. Try another term, clear the search, or widen the scope to{" "}
            <span className="text-[#E2E8F0]">All</span>.
          </p>
        </DashboardCard>
      ) : noData ? (
        <DashboardCard className="border-dashed border-[#22C1FF]/20 bg-[#0F1629]/90 p-6 sm:p-8">
          <p className="text-center text-lg font-semibold text-[#F8FAFC] sm:text-xl">No foundation records yet</p>
          <p className="mx-auto mt-3 max-w-xl text-center text-base leading-relaxed text-[#94A3B8]">
            Your directory will list patients, cases, clinics, and organisations as they are created. Start by adding an{" "}
            <strong className="text-[#E2E8F0]">organisation</strong> (your business or network), then a{" "}
            <strong className="text-[#E2E8F0]">clinic</strong> (each site or brand that sees patients).
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#directory-create-organisation"
              className="inline-flex min-w-[12rem] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-5 py-3 text-sm font-semibold text-white no-underline shadow-lg shadow-cyan-950/30 transition duration-200 hover:-translate-y-0.5 hover:from-cyan-500 hover:to-sky-500"
            >
              Create organisation
            </a>
            <a
              href="#directory-create-clinic"
              className="inline-flex min-w-[12rem] items-center justify-center rounded-xl border border-white/[0.15] bg-[#141C33]/80 px-5 py-3 text-sm font-semibold text-[#22C1FF] no-underline transition duration-200 hover:border-[#22C1FF]/40 hover:bg-[#141C33]"
            >
              Create clinic
            </a>
          </div>
          <p className="mt-4 text-center text-sm text-[#64748B]">
            Forms live in <a className="text-[#22C1FF] underline decoration-[#22C1FF]/40 underline-offset-2" href="#foundation-tools">Foundation records</a> below — these links scroll there.
          </p>
        </DashboardCard>
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
        <Group title="Clinical patients" hits={result.cases} empty="No clinical patients in this scope." />
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
