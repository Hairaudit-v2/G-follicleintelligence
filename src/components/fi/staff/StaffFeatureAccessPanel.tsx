"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { saveStaffFeatureAccessPatchAction } from "@/lib/actions/fi-staff-feature-access-actions";
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

function recordFromMap(m: Map<FiFeatureKey, boolean>): Record<FiFeatureKey, boolean> {
  return Object.fromEntries(m) as Record<FiFeatureKey, boolean>;
}

function diffPatch(before: Record<FiFeatureKey, boolean>, after: Record<FiFeatureKey, boolean>): Partial<Record<FiFeatureKey, boolean>> {
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
}) {
  const { tenantId, staffId, dbOverrides, initialExplicitWorkspaceProfile } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [workspacePending, startWorkspaceTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const baseline = useMemo(
    () => recordFromMap(applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), dbOverrides)),
    [dbOverrides]
  );

  const [values, setValues] = useState<Record<FiFeatureKey, boolean>>(baseline);

  const initialWorkspaceSelection: FiWorkspaceProfileKey = initialExplicitWorkspaceProfile ?? "default";
  const [workspaceSelection, setWorkspaceSelection] = useState<FiWorkspaceProfileKey>(initialWorkspaceSelection);

  useEffect(() => {
    setValues(baseline);
  }, [baseline, staffId]);

  useEffect(() => {
    setWorkspaceSelection(initialExplicitWorkspaceProfile ?? "default");
  }, [initialExplicitWorkspaceProfile, staffId]);

  const byCategory = useMemo(() => {
    const m = new Map<FiFeatureCategory, FiFeatureKey[]>();
    for (const cat of FI_FEATURE_CATEGORY_ORDER) m.set(cat, []);
    for (const key of listFiFeatureKeys()) {
      const cat = FI_FEATURE_REGISTRY[key].category;
      m.get(cat)!.push(key);
    }
    return m;
  }, []);

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
      const r = await saveStaffFeatureAccessPatchAction(tenantId, staffId, patch as Record<string, boolean>, null);
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

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-900">Workspace profile (FI OS)</h3>
      <p className="mt-1 text-xs text-gray-600">
        Suggests home layout and quick-action order. Stage 2 feature access overrides still apply — disabled modules stay
        hidden.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem]">
          <span className="text-xs font-medium text-gray-700">Workspace</span>
          <select
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
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
          className={workspaceMessage.kind === "ok" ? "mt-2 text-xs text-green-700" : "mt-2 text-xs text-red-700"}
          role="status"
        >
          {workspaceMessage.text}
        </p>
      ) : null}

      <h3 className="mt-8 text-sm font-semibold text-gray-900">Feature access (FI OS)</h3>
      <p className="mt-1 text-xs text-gray-600">
        Controls sidebar, home dashboard modules, and quick actions for this staff member. This is visibility only — route
        permissions are unchanged.
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
                      className="flex cursor-pointer items-start gap-2 rounded border border-gray-100 bg-gray-50/80 px-2 py-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={enabled}
                        disabled={pending}
                        onChange={(e) => onToggle(key, e.target.checked)}
                      />
                      <span>
                        <span className="text-sm font-medium text-gray-900">{meta.label}</span>
                        <span className="mt-0.5 block text-xs text-gray-600">{meta.description}</span>
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
          <span className={message.kind === "ok" ? "text-xs text-green-700" : "text-xs text-red-700"} role="status">
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
