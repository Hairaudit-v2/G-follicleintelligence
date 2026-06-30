"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PATHOLOGY_TEMPLATES, getPathologyTemplate } from "@/src/lib/pathology/pathologyTemplates";
import type { PathologyTemplateId } from "@/src/lib/pathology/pathologyTypes";

type Line = { clientId: string; code: string; label: string };

function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function linesFromTemplate(id: PathologyTemplateId): Line[] {
  const def = getPathologyTemplate(id);
  return (def?.defaultTests ?? []).map((t) => ({
    clientId: uid(),
    code: t.code ?? "",
    label: t.label,
  }));
}

export function BloodPathologyRequestClient({
  tenantId,
  patientId,
  defaultRequestDate,
}: {
  tenantId: string;
  patientId: string;
  defaultRequestDate: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<PathologyTemplateId>("hair_loss_investigation");
  const [requestDate, setRequestDate] = useState(defaultRequestDate);
  const [lines, setLines] = useState<Line[]>(() => linesFromTemplate("hair_loss_investigation"));
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateMeta = useMemo(() => getPathologyTemplate(templateId), [templateId]);

  const applyTemplate = useCallback((id: PathologyTemplateId) => {
    setTemplateId(id);
    setLines(linesFromTemplate(id));
    setError(null);
  }, []);

  const addLine = () => {
    setLines((prev) => [...prev, { clientId: uid(), code: "", label: "" }]);
  };

  const removeLine = (clientId: string) => {
    setLines((prev) => prev.filter((l) => l.clientId !== clientId));
  };

  const patchLine = (clientId: string, patch: Partial<Pick<Line, "code" | "label">>) => {
    setLines((prev) => prev.map((l) => (l.clientId === clientId ? { ...l, ...patch } : l)));
  };

  const save = async () => {
    setError(null);
    const tests = lines
      .map((l) => ({
        code: l.code.trim() ? l.code.trim() : null,
        label: l.label.trim(),
      }))
      .filter((t) => t.label.length > 0);
    if (tests.length === 0) {
      setError("Add at least one test with a label.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_used: templateId,
            request_date: requestDate,
            tests,
            clinical_notes: clinicalNotes.trim() ? clinicalNotes.trim() : null,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        pathology_request?: { id: string };
      };
      if (!res.ok || json.ok !== true) {
        setError(typeof json?.error === "string" ? json.error : `Save failed (${res.status}).`);
        return;
      }
      const newId = json.pathology_request?.id;
      if (newId) {
        router.push(`/fi-admin/${tenantId}/patients/${patientId}/blood-request/${newId}`);
      } else {
        router.push(`/fi-admin/${tenantId}/patients/${patientId}?tab=timeline`);
      }
      router.refresh();
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
        <h2 className="text-sm font-semibold text-slate-100">Template</h2>
        <p className="text-xs text-slate-400">
          Pick a panel to populate the test list. You can edit tests before saving.
        </p>
        <div className="space-y-2">
          {PATHOLOGY_TEMPLATES.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer flex-col rounded border p-3 text-sm ${
                templateId === t.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/[0.08] hover:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="tpl"
                  className="mt-1"
                  checked={templateId === t.id}
                  onChange={() => applyTemplate(t.id)}
                />
                <span>
                  <span className="font-medium text-slate-100">{t.label}</span>
                  <span className="mt-1 block text-xs text-slate-400">{t.description}</span>
                </span>
              </div>
            </label>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300" htmlFor="req-date">
            Request date
          </label>
          <input
            id="req-date"
            type="date"
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={requestDate}
            onChange={(e) => setRequestDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300" htmlFor="clinical-notes">
            Clinical notes / indication (optional)
          </label>
          <textarea
            id="clinical-notes"
            className="mt-1 w-full rounded border border-slate-700 px-2 py-2 text-sm"
            rows={4}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Shown on the PDF — e.g. indication, fasting, or lab preferences."
          />
        </div>
      </div>

      <div className="space-y-4 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Requested tests</h2>
            <p className="mt-1 text-xs text-slate-400">
              {templateMeta?.label ?? "Tests"} — {lines.length} line{lines.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.03]"
            onClick={addLine}
          >
            Add test
          </button>
        </div>

        <ul className="divide-y divide-white/[0.06] rounded border border-white/[0.06]">
          {lines.map((line) => (
            <li key={line.clientId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label className="text-[10px] font-semibold uppercase text-gray-500">
                  Test name
                </label>
                <input
                  className="w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                  value={line.label}
                  onChange={(e) => patchLine(line.clientId, { label: e.target.value })}
                  placeholder="e.g. Full blood count"
                />
              </div>
              <div className="w-full space-y-1 sm:w-32">
                <label className="text-[10px] font-semibold uppercase text-gray-500">Code</label>
                <input
                  className="w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                  value={line.code}
                  onChange={(e) => patchLine(line.clientId, { code: e.target.value })}
                  placeholder="FBC"
                />
              </div>
              <button
                type="button"
                className="rounded border border-rose-500/20 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                onClick={() => removeLine(line.clientId)}
                aria-label="Remove test"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save request"}
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.03]"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
