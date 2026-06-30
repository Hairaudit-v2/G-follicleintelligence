"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { saveStaffFeatureAccessPatchAction } from "@/lib/actions/fi-staff-feature-access-actions";
import { saveStaffPositionTypeAction } from "@/lib/actions/fi-staff-position-type-actions";
import { saveStaffWorkspaceProfileAction } from "@/lib/actions/fi-staff-workspace-profile-actions";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
  FI_FEATURE_CATEGORY_LABELS,
  FI_FEATURE_CATEGORY_ORDER,
  FI_FEATURE_REGISTRY,
  listFiFeatureKeys,
  type FiFeatureCategory,
  type FiFeatureKey,
} from "@/src/config/fiFeatureAccessRegistry";
import { FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILES } from "@/src/config/fiWorkspaceProfiles";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { buildStaffFiOsExperiencePreview } from "@/src/lib/fi-os/fiOsWorkspaceExperiencePreview";
import { parseExplicitWorkspaceProfile } from "@/src/lib/fi-os/workspaceProfileDerivation";

export type StaffPositionTypeOption = {
  id: string;
  tenant_id: string | null;
  code: string;
  title: string;
  default_workspace_profile: string | null;
  default_feature_template_key: string | null;
};

function recordFromMap(m: Map<FiFeatureKey, boolean>): Record<FiFeatureKey, boolean> {
  return Object.fromEntries(m) as Record<FiFeatureKey, boolean>;
}

function diffPatch(
  before: Record<FiFeatureKey, boolean>,
  after: Record<FiFeatureKey, boolean>
): Partial<Record<FiFeatureKey, boolean>> {
  const patch: Partial<Record<FiFeatureKey, boolean>> = {};
  for (const k of listFiFeatureKeys()) {
    if (before[k] !== after[k]) patch[k] = after[k];
  }
  return patch;
}

export function StaffFeatureAccessPanel(props: {
  tenantId: string;
  staffId: string;
  dbOverrides: Partial<Record<FiFeatureKey, boolean>>;
  /** Parsed explicit `staff_metadata.workspace_profile` (null = inherit automatic layout). */
  initialExplicitWorkspaceProfile: FiWorkspaceProfileKey | null;
  staffPositionTypeId: string | null;
  positionTypes: StaffPositionTypeOption[];
  /** Defaults from linked feature template (before per-staff overrides). */
  featureTemplateDefaults: Partial<Record<FiFeatureKey, boolean>>;
}) {
  const {
    tenantId,
    staffId,
    dbOverrides,
    initialExplicitWorkspaceProfile,
    staffPositionTypeId,
    positionTypes,
    featureTemplateDefaults,
  } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [workspacePending, startWorkspaceTransition] = useTransition();
  const [positionPending, startPositionTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [positionMessage, setPositionMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const baseline = useMemo(() => {
    const withTemplate = applyPartialFeatureOverrides(
      buildDefaultFeatureAccessAllEnabled(),
      featureTemplateDefaults
    );
    return recordFromMap(applyPartialFeatureOverrides(withTemplate, dbOverrides));
  }, [dbOverrides, featureTemplateDefaults]);

  const [values, setValues] = useState<Record<FiFeatureKey, boolean>>(baseline);

  const initialWorkspaceSelection: FiWorkspaceProfileKey =
    initialExplicitWorkspaceProfile ?? "default";
  const [workspaceSelection, setWorkspaceSelection] =
    useState<FiWorkspaceProfileKey>(initialWorkspaceSelection);

  const [positionTypeSelection, setPositionTypeSelection] = useState<string>(
    staffPositionTypeId ?? ""
  );

  useEffect(() => {
    setValues(baseline);
  }, [baseline, staffId]);

  useEffect(() => {
    setWorkspaceSelection(initialExplicitWorkspaceProfile ?? "default");
  }, [initialExplicitWorkspaceProfile, staffId]);

  useEffect(() => {
    setPositionTypeSelection(staffPositionTypeId ?? "");
  }, [staffPositionTypeId, staffId]);

  const selectedPosition = useMemo(
    () => positionTypes.find((p) => p.id === positionTypeSelection) ?? null,
    [positionTypes, positionTypeSelection]
  );

  const inheritedWorkspaceFromPosition = useMemo(() => {
    const raw = selectedPosition?.default_workspace_profile ?? null;
    return parseExplicitWorkspaceProfile(raw);
  }, [selectedPosition]);

  const byCategory = useMemo(() => {
    const m = new Map<FiFeatureCategory, FiFeatureKey[]>();
    for (const cat of FI_FEATURE_CATEGORY_ORDER) m.set(cat, []);
    for (const key of listFiFeatureKeys()) {
      const cat = FI_FEATURE_REGISTRY[key].category;
      m.get(cat)!.push(key);
    }
    return m;
  }, []);

  const previewWorkspaceProfile = useMemo((): FiWorkspaceProfileKey => {
    if (workspaceSelection !== "default") return workspaceSelection;
    return inheritedWorkspaceFromPosition ?? "default";
  }, [workspaceSelection, inheritedWorkspaceFromPosition]);

  const experiencePreviewLines = useMemo(
    () =>
      buildStaffFiOsExperiencePreview({
        workspaceProfile: previewWorkspaceProfile,
        effectiveFeatures: values,
      }),
    [previewWorkspaceProfile, values]
  );

  const onToggle = useCallback((key: FiFeatureKey, next: boolean) => {
    setValues((v) => ({ ...v, [key]: next }));
  }, []);

  const save = () => {
    setMessage(null);
    const patch = diffPatch(baseline, values);
    if (Object.keys(patch).length === 0) {
      setMessage({ kind: "ok", text: "No changes to save." });
      return;
    }
    startTransition(async () => {
      const r = await saveStaffFeatureAccessPatchAction(
        tenantId,
        staffId,
        patch as Record<string, boolean>,
        null
      );
      if (!r.ok) {
        setMessage({ kind: "err", text: r.error });
        return;
      }
      setMessage({ kind: "ok", text: "Feature access saved." });
      router.refresh();
    });
  };

  const saveWorkspace = () => {
    setWorkspaceMessage(null);
    startWorkspaceTransition(async () => {
      const r = await saveStaffWorkspaceProfileAction(tenantId, staffId, workspaceSelection, null);
      if (!r.ok) {
        setWorkspaceMessage({ kind: "err", text: r.error });
        return;
      }
      setWorkspaceMessage({ kind: "ok", text: "Workspace profile saved." });
      router.refresh();
    });
  };

  const savePositionType = () => {
    setPositionMessage(null);
    startPositionTransition(async () => {
      const nextId = positionTypeSelection.trim() || null;
      const r = await saveStaffPositionTypeAction(tenantId, staffId, nextId, null);
      if (!r.ok) {
        setPositionMessage({ kind: "err", text: r.error });
        return;
      }
      setPositionMessage({ kind: "ok", text: "Position type saved." });
      router.refresh();
    });
  };

  return (
    <div className="mt-6 border-t border-white/[0.08] pt-4">
      <h3 className="text-sm font-semibold text-slate-100">Position type (FI OS Stage 3.5)</h3>
      <p className="mt-1 text-xs text-slate-400">
        Position type sets default workspace and feature visibility templates. Manual feature
        toggles below override those defaults; per-staff feature access rows always win.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem]">
          <span className="text-xs font-medium text-slate-300">Position type</span>
          <select
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
            value={positionTypeSelection}
            disabled={positionPending}
            onChange={(e) => setPositionTypeSelection(e.target.value)}
          >
            <option value="">(none — use legacy staff role text only)</option>
            {positionTypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.code}){p.tenant_id ? " — clinic-specific" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={savePositionType}
          disabled={positionPending}
          className="rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {positionPending ? "Saving…" : "Save position type"}
        </button>
      </div>
      {selectedPosition ? (
        <ul className="mt-2 list-inside list-disc text-xs text-slate-400">
          <li>
            Default workspace profile from position:{" "}
            <span className="font-medium text-slate-200">
              {inheritedWorkspaceFromPosition
                ? FI_WORKSPACE_PROFILES[inheritedWorkspaceFromPosition].label
                : "(not set on position type)"}
            </span>
          </li>
          <li>
            Default feature template:{" "}
            <span className="font-medium text-slate-200">
              {selectedPosition.default_feature_template_key?.trim() || "(none)"}
            </span>
          </li>
        </ul>
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          No position type selected — workspace derivation falls back to legacy staff role
          heuristics.
        </p>
      )}
      {positionMessage ? (
        <p
          className={
            positionMessage.kind === "ok"
              ? "mt-2 text-xs text-emerald-300"
              : "mt-2 text-xs text-rose-300"
          }
          role="status"
        >
          {positionMessage.text}
        </p>
      ) : null}

      <h3 className="mt-8 text-sm font-semibold text-slate-100">Workspace profile (FI OS)</h3>
      <p className="mt-1 text-xs text-slate-400">
        Suggests home layout and quick-action order. When set, this manual profile overrides
        automatic layout (including position-type defaults). Stage 2 feature access overrides still
        apply — disabled modules stay hidden.
      </p>
      {initialExplicitWorkspaceProfile ? (
        <p className="mt-1 text-xs font-medium text-amber-300">
          Manual workspace override active:{" "}
          {FI_WORKSPACE_PROFILES[initialExplicitWorkspaceProfile].label}
        </p>
      ) : inheritedWorkspaceFromPosition && selectedPosition ? (
        <p className="mt-1 text-xs text-slate-400">
          Inherited layout persona from position (until you choose a manual workspace below):{" "}
          <span className="font-medium text-slate-200">
            {FI_WORKSPACE_PROFILES[inheritedWorkspaceFromPosition].label}
          </span>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem]">
          <span className="text-xs font-medium text-slate-300">Workspace</span>
          <select
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
            value={workspaceSelection}
            disabled={workspacePending}
            onChange={(e) => setWorkspaceSelection(e.target.value as FiWorkspaceProfileKey)}
          >
            {FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS.map((k) => (
              <option key={k} value={k}>
                {FI_WORKSPACE_PROFILES[k].label}
                {k === "default" ? " (automatic)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={saveWorkspace}
          disabled={workspacePending}
          className="rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {workspacePending ? "Saving…" : "Save workspace profile"}
        </button>
      </div>
      {workspaceMessage ? (
        <p
          className={
            workspaceMessage.kind === "ok"
              ? "mt-2 text-xs text-emerald-300"
              : "mt-2 text-xs text-rose-300"
          }
          role="status"
        >
          {workspaceMessage.text}
        </p>
      ) : null}

      <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
        <h3 className="text-sm font-semibold text-slate-100">Preview experience</h3>
        <p className="mt-1 text-xs text-slate-400">
          How the FI OS shell will feel with the toggles above — layout order is suggestive; Stage 2
          and route guards still apply.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-200">
          {experiencePreviewLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <h3 className="mt-8 text-sm font-semibold text-slate-100">Feature access (FI OS)</h3>
      <p className="mt-1 text-xs text-slate-400">
        Position type sets defaults; manual toggles override defaults. This is visibility only —
        route permissions are unchanged.
      </p>
      <div className="mt-3 space-y-4">
        {FI_FEATURE_CATEGORY_ORDER.map((cat) => {
          const keys = byCategory.get(cat) ?? [];
          if (!keys.length) return null;
          return (
            <div key={cat}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {FI_FEATURE_CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-2">
                {keys.map((key) => {
                  const meta = FI_FEATURE_REGISTRY[key];
                  const enabled = values[key] !== false;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-2 rounded border border-white/[0.06] bg-white/[0.03] px-2 py-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={enabled}
                        disabled={pending}
                        onChange={(e) => onToggle(key, e.target.checked)}
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-100">{meta.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {meta.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save feature access"}
        </button>
        {message ? (
          <span
            className={message.kind === "ok" ? "text-xs text-emerald-300" : "text-xs text-rose-300"}
            role="status"
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
