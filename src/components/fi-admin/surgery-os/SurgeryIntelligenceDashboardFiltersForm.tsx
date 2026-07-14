"use client";

import type { SurgeryIntelligenceDashboardPayload } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceDashboardTypes";

type Props = {
  baseHref: string;
  filters: SurgeryIntelligenceDashboardPayload["filters"];
  filterOptions: SurgeryIntelligenceDashboardPayload["filterOptions"];
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#0c1426]/80 px-3 py-2 text-sm text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#22C1FF]/50 focus:outline-none";

export function SurgeryIntelligenceDashboardFiltersForm({
  baseHref,
  filters,
  filterOptions,
}: Props) {
  return (
    <form
      method="get"
      action={baseHref}
      className="grid gap-3 rounded-xl border border-white/[0.08] bg-[#141C33]/50 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Published from
        </span>
        <input
          type="date"
          name="from"
          defaultValue={filters.occurredAfter?.slice(0, 10) ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Published to
        </span>
        <input
          type="date"
          name="to"
          defaultValue={filters.occurredBefore?.slice(0, 10) ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Procedure from
        </span>
        <input
          type="date"
          name="procedure_from"
          defaultValue={filters.procedureDateAfter ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Procedure to
        </span>
        <input
          type="date"
          name="procedure_to"
          defaultValue={filters.procedureDateBefore ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Surgeon
        </span>
        <select name="surgeon" defaultValue={filters.surgeonFiUserId ?? ""} className={inputClass}>
          <option value="">All surgeons</option>
          {filterOptions.surgeons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Team member
        </span>
        <select name="team" defaultValue={filters.teamFiUserId ?? ""} className={inputClass}>
          <option value="">All team</option>
          {filterOptions.teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Clinic
        </span>
        <select name="clinic" defaultValue={filters.clinicId ?? ""} className={inputClass}>
          <option value="">All clinics</option>
          {filterOptions.clinics.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Final count source
        </span>
        <select
          name="source"
          defaultValue={filters.graftCountSource ?? "all"}
          className={inputClass}
        >
          <option value="all">All sources</option>
          <option value="ai">AI accepted</option>
          <option value="manual">Manual</option>
          <option value="override">Override</option>
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="rounded-lg bg-[#22C1FF]/15 px-4 py-2 text-sm font-medium text-[#22C1FF] ring-1 ring-[#22C1FF]/30 hover:bg-[#22C1FF]/25"
        >
          Apply filters
        </button>
        <a
          href={baseHref}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:text-[#E2E8F0]"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
