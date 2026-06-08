"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PATHOLOGY_RESULT_QUICK_PANELS } from "@/src/lib/pathology/pathologyResultQuickPanels";
import type { PathologyRequestOptionRow } from "@/src/lib/pathology/pathologyResultTypes";

type Flag = "low" | "normal" | "high" | "critical" | "unknown";

type MarkerRow = {
  clientId: string;
  test_code: string;
  test_label: string;
  result_value: string;
  result_unit: string;
  reference_range: string;
  flag: Flag;
};

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyRow(): MarkerRow {
  return {
    clientId: uid(),
    test_code: "",
    test_label: "",
    result_value: "",
    result_unit: "",
    reference_range: "",
    flag: "unknown",
  };
}

export function BloodPathologyResultNewClient({
  tenantId,
  patientId,
  defaultResultDate,
  requestOptions,
}: {
  tenantId: string;
  patientId: string;
  defaultResultDate: string;
  requestOptions: PathologyRequestOptionRow[];
}) {
  const router = useRouter();
  const [resultDate, setResultDate] = useState(defaultResultDate);
  const [providerName, setProviderName] = useState("");
  const [pathologyRequestId, setPathologyRequestId] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [rows, setRows] = useState<MarkerRow[]>([emptyRow()]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => setRows((p) => [...p, emptyRow()]);
  const removeRow = (id: string) => setRows((p) => (p.length <= 1 ? p : p.filter((r) => r.clientId !== id)));
  const patchRow = (id: string, patch: Partial<MarkerRow>) => {
    setRows((p) => p.map((r) => (r.clientId === id ? { ...r, ...patch } : r)));
  };

  const appendPanel = useCallback((panelId: string) => {
    const panel = PATHOLOGY_RESULT_QUICK_PANELS.find((p) => p.id === panelId);
    if (!panel) return;
    setRows((prev) => [
      ...prev,
      ...panel.rows.map((row) => ({
        clientId: uid(),
        test_code: row.test_code ?? "",
        test_label: row.test_label,
        result_value: "",
        result_unit: row.result_unit ?? "",
        reference_range: row.reference_range ?? "",
        flag: row.flag,
      })),
    ]);
  }, []);

  const itemsPayload = useMemo(
    () =>
      rows
        .filter((r) => r.test_label.trim())
        .map((r) => ({
          test_code: r.test_code.trim() ? r.test_code.trim() : null,
          test_label: r.test_label.trim(),
          result_value: r.result_value.trim(),
          result_unit: r.result_unit.trim() ? r.result_unit.trim() : null,
          reference_range: r.reference_range.trim() ? r.reference_range.trim() : null,
          flag: r.flag,
        })),
    [rows]
  );

  const submit = async (status: "draft" | "reviewed") => {
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.set("result_date", resultDate);
      if (providerName.trim()) form.set("provider_name", providerName.trim());
      if (pathologyRequestId.trim()) form.set("pathology_request_id", pathologyRequestId.trim());
      if (clinicalSummary.trim()) form.set("clinical_summary", clinicalSummary.trim());
      form.set("status", status);
      form.set("items", JSON.stringify(itemsPayload));
      if (file) form.set("file", file);

      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-results`,
        { method: "POST", body: form }
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; pathology_result?: { id: string } };
      if (!res.ok || json.ok !== true) {
        setError(typeof json?.error === "string" ? json.error : `Save failed (${res.status}).`);
        return;
      }
      const newId = json.pathology_result?.id;
      if (newId) {
        router.push(`/fi-admin/${tenantId}/patients/${patientId}/blood-results/${newId}`);
      } else {
        router.push(`/fi-admin/${tenantId}/patients/${patientId}`);
      }
      router.refresh();
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Result details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-700">Result date</span>
            <input
              type="date"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={resultDate}
              onChange={(e) => setResultDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Provider / lab (optional)</span>
            <input
              type="text"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="e.g. Sonic / local lab"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">Link to blood request (optional)</span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={pathologyRequestId}
            onChange={(e) => setPathologyRequestId(e.target.value)}
          >
            <option value="">— None —</option>
            {requestOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.request_date} · {o.template_used.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Clinical summary (optional)</span>
          <textarea
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            rows={3}
            value={clinicalSummary}
            onChange={(e) => setClinicalSummary(e.target.value)}
            placeholder="Short free-text summary for colleagues (not AI interpretation)."
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Upload pathology PDF (optional)</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="mt-1 w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? <p className="mt-1 text-xs text-gray-500">Selected: {file.name}</p> : null}
        </label>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Structured markers</h2>
          <button type="button" className="text-xs font-medium text-sky-700 hover:underline" onClick={addRow}>
            + Add row
          </button>
        </div>
        <p className="text-xs text-gray-600">Enter at least a test name for each row you want stored. Values can be filled after quick-add.</p>

        <div className="flex flex-wrap gap-2">
          {PATHOLOGY_RESULT_QUICK_PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-100"
              onClick={() => appendPanel(p.id)}
            >
              + {p.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-2 font-medium">Test</th>
                <th className="py-1 pr-2 font-medium">Code</th>
                <th className="py-1 pr-2 font-medium">Value</th>
                <th className="py-1 pr-2 font-medium">Unit</th>
                <th className="py-1 pr-2 font-medium">Ref. range</th>
                <th className="py-1 pr-2 font-medium">Flag</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.clientId} className="border-b border-gray-100 align-top">
                  <td className="py-1 pr-2">
                    <input
                      className="w-40 max-w-full rounded border border-gray-200 px-1 py-0.5"
                      value={r.test_label}
                      onChange={(e) => patchRow(r.clientId, { test_label: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className="w-20 max-w-full rounded border border-gray-200 px-1 py-0.5"
                      value={r.test_code}
                      onChange={(e) => patchRow(r.clientId, { test_code: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className="w-24 max-w-full rounded border border-gray-200 px-1 py-0.5"
                      value={r.result_value}
                      onChange={(e) => patchRow(r.clientId, { result_value: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className="w-20 max-w-full rounded border border-gray-200 px-1 py-0.5"
                      value={r.result_unit}
                      onChange={(e) => patchRow(r.clientId, { result_unit: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className="w-28 max-w-full rounded border border-gray-200 px-1 py-0.5"
                      value={r.reference_range}
                      onChange={(e) => patchRow(r.clientId, { reference_range: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border border-gray-200 px-1 py-0.5"
                      value={r.flag}
                      onChange={(e) => patchRow(r.clientId, { flag: e.target.value as Flag })}
                    >
                      <option value="unknown">Unknown</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </td>
                  <td className="py-1">
                    <button type="button" className="text-red-600 hover:underline" onClick={() => removeRow(r.clientId)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-50"
          onClick={() => void submit("draft")}
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          onClick={() => void submit("reviewed")}
        >
          Mark reviewed
        </button>
      </div>
    </div>
  );
}
