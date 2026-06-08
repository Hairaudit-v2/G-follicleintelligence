"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PathologyAiInterpretationRow } from "@/src/lib/pathology/pathologyAiInterpretationTypes";
import type { PathologyRequestOptionRow, PathologyResultDetailBundle, PathologyResultItemRow } from "@/src/lib/pathology/pathologyResultTypes";

type Flag = PathologyResultItemRow["flag"];

type EditableRow = {
  clientId: string;
  test_code: string;
  test_label: string;
  result_value: string;
  result_unit: string;
  reference_range: string;
  flag: Flag;
};

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `e-${Date.now()}`;
}

function rowsFromItems(items: PathologyResultItemRow[]): EditableRow[] {
  return items.map((i) => ({
    clientId: i.id || uid(),
    test_code: i.test_code ?? "",
    test_label: i.test_label,
    result_value: i.result_value,
    result_unit: i.result_unit ?? "",
    reference_range: i.reference_range ?? "",
    flag: i.flag,
  }));
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900">
      {label}: {value}/100
    </span>
  );
}

function ContributorList({ items }: { items: PathologyAiInterpretationRow["interpretation_json"]["likely_contributors"] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">None listed.</p>;
  return (
    <ul className="space-y-1 text-sm text-gray-800">
      {items.map((item, idx) => (
        <li key={`${item.name}-${idx}`}>
          <span className="font-medium">{item.name}:</span> {item.rationale}
        </li>
      ))}
    </ul>
  );
}

function MarkerList({ items }: { items: PathologyAiInterpretationRow["interpretation_json"]["abnormal_markers"] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">None listed.</p>;
  return (
    <ul className="space-y-1 text-sm text-gray-800">
      {items.map((item, idx) => (
        <li key={`${item.marker}-${idx}`}>
          <span className="font-medium">{item.marker}</span>
          {item.value ? ` ${item.value}` : ""}
          {item.unit ? ` ${item.unit}` : ""}
          {item.reference_range ? ` (ref ${item.reference_range})` : ""}
          {item.flag ? ` · ${item.flag}` : ""}
          <span className="block text-xs text-gray-600">{item.hair_relevance}</span>
          {item.suggested_next_step ? <span className="block text-xs text-gray-500">Next: {item.suggested_next_step}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ConsiderationList({ items }: { items: PathologyAiInterpretationRow["interpretation_json"]["treatment_considerations"] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">None listed.</p>;
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-gray-800">
      {items.map((item, idx) => (
        <li key={`${item.label}-${idx}`}>
          <span className="font-medium">{item.label}</span>
          {item.rationale ? <span className="text-gray-600"> · {item.rationale}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function RepeatTestingList({ items }: { items: PathologyAiInterpretationRow["interpretation_json"]["repeat_testing_recommendations"] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">None listed.</p>;
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-gray-800">
      {items.map((item, idx) => (
        <li key={`${item.marker_or_panel}-${idx}`}>
          <span className="font-medium">{item.marker_or_panel}</span>
          <span className="text-gray-600"> · {item.rationale}</span>
          {item.suggested_timing ? <span className="text-gray-500"> · {item.suggested_timing}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function BloodPathologyResultDetailClient({
  tenantId,
  patientId,
  bundle: initialBundle,
  requestOptions,
  aiInterpretation: initialAiInterpretation,
}: {
  tenantId: string;
  patientId: string;
  bundle: PathologyResultDetailBundle;
  requestOptions: PathologyRequestOptionRow[];
  aiInterpretation: PathologyAiInterpretationRow | null;
}) {
  const router = useRouter();
  const [bundle, setBundle] = useState(initialBundle);
  const [rows, setRows] = useState<EditableRow[]>(() => rowsFromItems(initialBundle.items));
  const [clinicalSummary, setClinicalSummary] = useState(initialBundle.result.clinical_summary ?? "");
  const [providerName, setProviderName] = useState(initialBundle.result.provider_name ?? "");
  const [resultDate, setResultDate] = useState(initialBundle.result.result_date);
  const [pathologyRequestId, setPathologyRequestId] = useState(initialBundle.result.pathology_request_id ?? "");
  const [aiInterpretation, setAiInterpretation] = useState<PathologyAiInterpretationRow | null>(initialAiInterpretation);
  const [doctorSummary, setDoctorSummary] = useState(initialAiInterpretation?.doctor_summary ?? "");
  const [patientFriendlySummary, setPatientFriendlySummary] = useState(initialAiInterpretation?.patient_friendly_summary ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBundle(initialBundle);
    setRows(rowsFromItems(initialBundle.items));
    setClinicalSummary(initialBundle.result.clinical_summary ?? "");
    setProviderName(initialBundle.result.provider_name ?? "");
    setResultDate(initialBundle.result.result_date);
    setPathologyRequestId(initialBundle.result.pathology_request_id ?? "");
  }, [initialBundle]);

  useEffect(() => {
    setAiInterpretation(initialAiInterpretation);
    setDoctorSummary(initialAiInterpretation?.doctor_summary ?? "");
    setPatientFriendlySummary(initialAiInterpretation?.patient_friendly_summary ?? "");
  }, [initialAiInterpretation]);

  const isDraft = bundle.result.status === "draft";
  const isArchived = bundle.result.status === "archived";

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

  const patchRow = (id: string, patch: Partial<EditableRow>) => {
    setRows((p) => p.map((r) => (r.clientId === id ? { ...r, ...patch } : r)));
  };

  const saveDraft = async () => {
    if (!isDraft) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-results/${encodeURIComponent(bundle.result.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_draft",
            result_date: resultDate,
            provider_name: providerName.trim() ? providerName.trim() : null,
            pathology_request_id: pathologyRequestId.trim() ? pathologyRequestId.trim() : null,
            clinical_summary: clinicalSummary.trim() ? clinicalSummary.trim() : null,
            items: itemsPayload,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        pathology_result?: PathologyResultDetailBundle["result"];
        items?: PathologyResultItemRow[];
        linked_request?: PathologyResultDetailBundle["linkedRequest"];
      };
      if (!res.ok || json.ok !== true) {
        setError(typeof json?.error === "string" ? json.error : `Update failed (${res.status}).`);
        return;
      }
      if (json.pathology_result) {
        setBundle((b) => ({ ...b, result: json.pathology_result! }));
      }
      if (json.items) {
        setRows(rowsFromItems(json.items));
        setBundle((b) => ({ ...b, items: json.items! }));
      }
      if (json.linked_request !== undefined) {
        setBundle((b) => ({ ...b, linkedRequest: json.linked_request ?? null }));
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async () => {
    if (!isDraft) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-results/${encodeURIComponent(bundle.result.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mark_reviewed",
            clinical_summary: clinicalSummary.trim() ? clinicalSummary.trim() : null,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; pathology_result?: PathologyResultDetailBundle["result"] };
      if (!res.ok || json.ok !== true) {
        setError(typeof json?.error === "string" ? json.error : `Update failed (${res.status}).`);
        return;
      }
      if (json.pathology_result) {
        setBundle((b) => ({ ...b, result: json.pathology_result! }));
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (isArchived) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-results/${encodeURIComponent(bundle.result.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; pathology_result?: PathologyResultDetailBundle["result"] };
      if (!res.ok || json.ok !== true) {
        setError(typeof json?.error === "string" ? json.error : `Archive failed (${res.status}).`);
        return;
      }
      if (json.pathology_result) {
        setBundle((b) => ({ ...b, result: json.pathology_result! }));
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const aiEndpoint = `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/pathology-results/${encodeURIComponent(bundle.result.id)}/ai-interpretation`;

  const generateAiInterpretation = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(aiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; interpretation?: PathologyAiInterpretationRow };
      if (!res.ok || json.ok !== true || !json.interpretation) {
        setError(typeof json?.error === "string" ? json.error : `AI generation failed (${res.status}).`);
        return;
      }
      setAiInterpretation(json.interpretation);
      setDoctorSummary(json.interpretation.doctor_summary ?? "");
      setPatientFriendlySummary(json.interpretation.patient_friendly_summary ?? "");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const patchAiInterpretation = async (action: "update_summaries" | "mark_reviewed" | "archive") => {
    if (!aiInterpretation) return;
    setError(null);
    setBusy(true);
    try {
      const body =
        action === "update_summaries"
          ? {
              action,
              interpretation_id: aiInterpretation.id,
              doctor_summary: doctorSummary.trim() ? doctorSummary.trim() : null,
              patient_friendly_summary: patientFriendlySummary.trim() ? patientFriendlySummary.trim() : null,
            }
          : { action, interpretation_id: aiInterpretation.id };
      const res = await fetch(aiEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; interpretation?: PathologyAiInterpretationRow };
      if (!res.ok || json.ok !== true || !json.interpretation) {
        setError(typeof json?.error === "string" ? json.error : `AI update failed (${res.status}).`);
        return;
      }
      if (action === "archive") {
        setAiInterpretation(null);
        setDoctorSummary("");
        setPatientFriendlySummary("");
      } else {
        setAiInterpretation(json.interpretation);
        setDoctorSummary(json.interpretation.doctor_summary ?? "");
        setPatientFriendlySummary(json.interpretation.patient_friendly_summary ?? "");
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const abnormalCount = bundle.items.filter((i) => i.flag === "low" || i.flag === "high" || i.flag === "critical").length;

  return (
    <div className="space-y-6">
      {isArchived ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This result is archived.</p>
      ) : null}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-2 text-sm">
        <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
        <dl className="grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Status</dt>
            <dd className="font-medium capitalize">{bundle.result.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Source</dt>
            <dd className="font-medium">{bundle.result.source_type.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Result date</dt>
            <dd>
              {isDraft ? (
                <input
                  type="date"
                  className="mt-0.5 rounded border border-gray-300 px-2 py-1 text-sm"
                  value={resultDate}
                  onChange={(e) => setResultDate(e.target.value)}
                />
              ) : (
                <span className="font-medium">{bundle.result.result_date}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Provider</dt>
            <dd>
              {isDraft ? (
                <input
                  className="mt-0.5 w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                />
              ) : (
                <span className="font-medium">{bundle.result.provider_name ?? "—"}</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Linked blood request</dt>
            <dd>
              {isDraft ? (
                <select
                  className="mt-1 w-full max-w-lg rounded border border-gray-300 px-2 py-1.5 text-sm"
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
              ) : bundle.linkedRequest ? (
                <Link
                  href={`/fi-admin/${tenantId}/patients/${patientId}/blood-request/${bundle.linkedRequest.id}`}
                  className="font-medium text-sky-700 hover:underline"
                >
                  {bundle.linkedRequest.request_date} · {bundle.linkedRequest.template_used.replace(/_/g, " ")} ({bundle.linkedRequest.status})
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Reviewed</dt>
            <dd className="text-gray-800">
              {bundle.result.reviewed_at ? (
                <>
                  {bundle.reviewerDisplayName ?? bundle.result.reviewed_by_user_id ?? "Unknown"}
                  <span className="text-gray-500"> · </span>
                  {new Date(bundle.result.reviewed_at).toLocaleString()}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Structured markers</dt>
            <dd className="font-medium">
              {bundle.items.length} total
              {abnormalCount > 0 ? (
                <span className="ml-2 text-amber-800">
                  · {abnormalCount} abnormal (low / high / critical)
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {bundle.pdfSignedUrl ? (
        <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Uploaded PDF</h2>
          <a
            href={bundle.pdfSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline"
          >
            Open PDF (signed link, expires in ~1 hour)
          </a>
          {typeof bundle.result.metadata.original_filename === "string" ? (
            <p className="mt-1 text-xs text-gray-500">Original file: {bundle.result.metadata.original_filename}</p>
          ) : null}
        </section>
      ) : bundle.result.uploaded_file_path ? (
        <p className="text-sm text-amber-800">PDF is stored but a signed link could not be generated. Refresh the page or check storage permissions.</p>
      ) : null}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Clinical summary</h2>
        {isDraft ? (
          <textarea
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            rows={4}
            value={clinicalSummary}
            onChange={(e) => setClinicalSummary(e.target.value)}
          />
        ) : (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{bundle.result.clinical_summary?.trim() ? bundle.result.clinical_summary : "—"}</p>
        )}
      </section>

      <section className="rounded border border-sky-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Hair Loss Interpretation</h2>
            <p className="mt-1 text-xs text-gray-600">
              This interpretation is clinical decision support only and must be reviewed by the treating clinician.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || bundle.items.length === 0 || isArchived}
              className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              onClick={() => void generateAiInterpretation()}
            >
              {aiInterpretation ? "Regenerate" : "Generate"}
            </button>
            {aiInterpretation ? (
              <>
                <button
                  type="button"
                  disabled={busy || aiInterpretation.status === "archived"}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => void patchAiInterpretation("update_summaries")}
                >
                  Save summaries
                </button>
                <button
                  type="button"
                  disabled={busy || aiInterpretation.status === "doctor_reviewed"}
                  className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => void patchAiInterpretation("mark_reviewed")}
                >
                  Mark doctor reviewed
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
                  onClick={() => void patchAiInterpretation("archive")}
                >
                  Archive
                </button>
              </>
            ) : null}
          </div>
        </div>

        {!aiInterpretation ? (
          <p className="text-sm text-gray-600">
            No AI interpretation has been generated for this result yet. Generate uses the structured marker rows only and creates a new draft.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium capitalize text-gray-800">
                {aiInterpretation.status.replace(/_/g, " ")}
              </span>
              <ScorePill label="Hair relevance" value={aiInterpretation.hair_loss_relevance_score} />
              <ScorePill label="Surgery readiness" value={aiInterpretation.surgical_readiness_score} />
            </div>

            <div className="rounded border border-sky-100 bg-sky-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-900">Overview</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-sky-950">{aiInterpretation.interpretation_json.overview}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Likely contributors</h3>
                <div className="mt-2">
                  <ContributorList items={aiInterpretation.interpretation_json.likely_contributors} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risk flags</h3>
                {aiInterpretation.interpretation_json.risk_flags.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">None listed.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-gray-800">
                    {aiInterpretation.interpretation_json.risk_flags.map((f, idx) => (
                      <li key={`${f.label}-${idx}`}>
                        <span className="font-medium">{f.label}</span>
                        <span className="text-gray-600"> · {f.urgency.replace(/_/g, " ")} · {f.rationale}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Abnormal markers</h3>
                <div className="mt-2">
                  <MarkerList items={aiInterpretation.interpretation_json.abnormal_markers} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suboptimal for hair</h3>
                <div className="mt-2">
                  <MarkerList items={aiInterpretation.interpretation_json.suboptimal_markers_for_hair} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Treatment</h3>
                <div className="mt-2">
                  <ConsiderationList items={aiInterpretation.interpretation_json.treatment_considerations} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Supplements</h3>
                <div className="mt-2">
                  <ConsiderationList items={aiInterpretation.interpretation_json.supplement_considerations} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Medications</h3>
                <div className="mt-2">
                  <ConsiderationList items={aiInterpretation.interpretation_json.medication_considerations} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Surgery readiness</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{aiInterpretation.interpretation_json.surgery_readiness.narrative}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Repeat testing</h3>
                <div className="mt-2">
                  <RepeatTestingList items={aiInterpretation.interpretation_json.repeat_testing_recommendations} />
                </div>
              </div>
            </div>

            {aiInterpretation.interpretation_json.missing_markers.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Missing markers to consider</h3>
                <div className="mt-2">
                  <MarkerList items={aiInterpretation.interpretation_json.missing_markers} />
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Doctor summary</span>
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  rows={5}
                  value={doctorSummary}
                  onChange={(e) => setDoctorSummary(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Patient-friendly summary</span>
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  rows={5}
                  value={patientFriendlySummary}
                  onChange={(e) => setPatientFriendlySummary(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Markers</h2>
          {isDraft ? (
            <button
              type="button"
              className="text-xs font-medium text-sky-700 hover:underline"
              onClick={() =>
                setRows((p) => [
                  ...p,
                  {
                    clientId: uid(),
                    test_code: "",
                    test_label: "",
                    result_value: "",
                    result_unit: "",
                    reference_range: "",
                    flag: "unknown",
                  },
                ])
              }
            >
              + Add row
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-2 font-medium">Test</th>
                <th className="py-1 pr-2 font-medium">Code</th>
                <th className="py-1 pr-2 font-medium">Value</th>
                <th className="py-1 pr-2 font-medium">Unit</th>
                <th className="py-1 pr-2 font-medium">Ref.</th>
                <th className="py-1 pr-2 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {isDraft
                ? rows.map((r) => (
                    <tr key={r.clientId} className="border-b border-gray-100 align-top">
                      <td className="py-1 pr-2">
                        <input
                          className="w-36 max-w-full rounded border border-gray-200 px-1 py-0.5"
                          value={r.test_label}
                          onChange={(e) => patchRow(r.clientId, { test_label: e.target.value })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-16 max-w-full rounded border border-gray-200 px-1 py-0.5"
                          value={r.test_code}
                          onChange={(e) => patchRow(r.clientId, { test_code: e.target.value })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-20 max-w-full rounded border border-gray-200 px-1 py-0.5"
                          value={r.result_value}
                          onChange={(e) => patchRow(r.clientId, { result_value: e.target.value })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-16 max-w-full rounded border border-gray-200 px-1 py-0.5"
                          value={r.result_unit}
                          onChange={(e) => patchRow(r.clientId, { result_unit: e.target.value })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-24 max-w-full rounded border border-gray-200 px-1 py-0.5"
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
                    </tr>
                  ))
                : bundle.items.map((i) => (
                    <tr key={i.id} className="border-b border-gray-100 align-top">
                      <td className="py-1 pr-2">{i.test_label}</td>
                      <td className="py-1 pr-2">{i.test_code || "—"}</td>
                      <td className="py-1 pr-2">{i.result_value}</td>
                      <td className="py-1 pr-2">{i.result_unit || "—"}</td>
                      <td className="py-1 pr-2">{i.reference_range || "—"}</td>
                      <td className="py-1 pr-2">
                        <span className={i.flag === "normal" || i.flag === "unknown" ? "" : "font-semibold text-amber-900"}>{i.flag}</span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isArchived ? (
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-50"
                onClick={() => void saveDraft()}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                onClick={() => void markReviewed()}
              >
                Mark reviewed
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
            onClick={() => void archive()}
          >
            Archive
          </button>
        </div>
      ) : null}

      {isDraft ? (
        <p className="text-xs text-gray-600">
          Save draft to persist marker rows, the linked request, and summary fields before marking reviewed.
        </p>
      ) : null}
    </div>
  );
}
