"use client";

import type { FiUserPickerOption } from "@/src/lib/cases/procedureDayLoaders";

import { caseFormField } from "./caseFormFieldProps";

const TEAM_MEMBER_SELECT = caseFormField("procedure-team-add-member");

export function CaseProcedureTeamPanel({
  teamIds,
  userOptions,
  excludeUserIds,
  onChange,
}: {
  teamIds: string[];
  userOptions: FiUserPickerOption[];
  excludeUserIds?: string[];
  onChange: (next: string[]) => void;
}) {
  const exclude = new Set((excludeUserIds ?? []).filter(Boolean));

  const available = userOptions.filter((u) => !teamIds.includes(u.id) && !exclude.has(u.id));

  function labelFor(id: string): string {
    const u = userOptions.find((x) => x.id === id);
    if (!u) return id.slice(0, 8) + "…";
    return u.email?.trim() || u.role?.trim() || `${u.id.slice(0, 8)}…`;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-800">Team members (fi_users)</h3>
      <p className="text-xs text-gray-500">Nurses and additional staff on the procedure record (surgeon is set separately).</p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={TEAM_MEMBER_SELECT.id} className="sr-only">
          Add team member
        </label>
        <select
          {...TEAM_MEMBER_SELECT}
          className="max-w-md rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (!v) return;
            if (!teamIds.includes(v)) onChange([...teamIds, v]);
          }}
        >
          <option value="">Add team member…</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.email ?? "—") + (u.role ? ` · ${u.role}` : "")}
            </option>
          ))}
        </select>
      </div>
      {teamIds.length === 0 ? (
        <p className="text-xs text-gray-400">No team members selected.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {teamIds.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-800"
            >
              <span>{labelFor(id)}</span>
              <button type="button" className="text-rose-600 hover:underline" onClick={() => onChange(teamIds.filter((x) => x !== id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
