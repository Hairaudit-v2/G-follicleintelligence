"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { FiOsEmptyState } from "@/src/components/fi-admin/shared/FiOsEmptyState";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type {
  PathologyExtractionPreviewMarker,
  PathologyInboundDocumentListItem,
  PathologyInboundExtractionStatus,
  PathologyInboundMatchStatus,
} from "@/src/lib/pathology/pathologyInboxTypes";

const STATUS_LABELS: Record<PathologyInboundMatchStatus, string> = {
  pending: "Pending match",
  matched: "Matched",
  rejected: "Rejected",
  promoted: "Promoted",
};

const EXTRACTION_STATUS_LABELS: Record<PathologyInboundExtractionStatus, string> = {
  not_started: "Not started",
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  needs_review: "Needs review",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function confidenceLabel(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function previewMarkersFromJob(
  doc: PathologyInboundDocumentListItem
): PathologyExtractionPreviewMarker[] {
  const items = doc.extraction_job?.normalized_items_json;
  if (!Array.isArray(items)) return [];
  return items
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        test_code: r.test_code != null ? String(r.test_code) : null,
        test_label: String(r.test_label ?? ""),
        result_value: String(r.result_value ?? ""),
        result_unit: r.result_unit != null ? String(r.result_unit) : null,
        reference_range: r.reference_range != null ? String(r.reference_range) : null,
        flag: String(r.flag ?? "unknown"),
        confidence:
          typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : null,
      };
    })
    .filter((m) => m.test_label.trim().length > 0);
}

function miPreviewInsightCount(doc: PathologyInboundDocumentListItem): number {
  const preview = doc.extraction_job?.medical_intelligence_preview_json;
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return 0;
  const markers = (preview as { interpretedMarkers?: unknown }).interpretedMarkers;
  return Array.isArray(markers) ? markers.length : 0;
}

export function PathologyResultsInboxClient(props: {
  tenantId: string;
  initialDocuments: PathologyInboundDocumentListItem[];
  canMutate: boolean;
  extractionEnabled: boolean;
}) {
  const { tenantId, initialDocuments, canMutate, extractionEnabled } = props;
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [statusFilter, setStatusFilter] = useState<PathologyInboundMatchStatus | "all">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDocuments.find((d) => d.match_status === "pending")?.id ?? null
  );
  const [file, setFile] = useState<File | null>(null);
  const [extractedName, setExtractedName] = useState("");
  const [extractedDob, setExtractedDob] = useState("");
  const [extractedMrn, setExtractedMrn] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; message: string } | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    if (statusFilter === "all") return documents;
    return documents.filter((d) => d.match_status === statusFilter);
  }, [documents, statusFilter]);

  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null;
  const selectedMarkers = selected ? previewMarkersFromJob(selected) : [];
  const selectedMiCount = selected ? miPreviewInsightCount(selected) : 0;

  function patchDocument(updated: PathologyInboundDocumentListItem) {
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.id === updated.id);
      if (idx < 0) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  async function postJson<T>(url: string, body?: unknown): Promise<T & { ok?: boolean; error?: string }> {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  }

  function onUpload() {
    if (!canMutate || !file) return;
    setFeedback(null);
    start(async () => {
      try {
        const form = new FormData();
        form.set("file", file);
        if (extractedName.trim()) form.set("extracted_patient_name", extractedName.trim());
        if (extractedDob.trim()) form.set("extracted_dob", extractedDob.trim());
        if (extractedMrn.trim()) form.set("extracted_mrn", extractedMrn.trim());

        const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/pathology-inbox`, {
          method: "POST",
          body: form,
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          document?: PathologyInboundDocumentListItem;
        };
        if (!res.ok || json.ok !== true || !json.document) {
          setFeedback({
            tone: "err",
            message: typeof json.error === "string" ? json.error : `Upload failed (${res.status}).`,
          });
          return;
        }
        patchDocument(json.document);
        setSelectedId(json.document.id);
        setFile(null);
        setExtractedName("");
        setExtractedDob("");
        setExtractedMrn("");
        setFeedback({
          tone: "ok",
          message: extractionEnabled
            ? "PDF uploaded — extraction queued automatically."
            : "PDF uploaded to inbox.",
        });
        router.refresh();
      } catch {
        setFeedback({ tone: "err", message: "Network error during upload." });
      }
    });
  }

  function onMatchAction(action: "confirm" | "reject" | "suggest") {
    if (!canMutate || !selected) return;
    setFeedback(null);
    start(async () => {
      try {
        const body: Record<string, unknown> = { action };
        if (action === "confirm") {
          const patientId = selected.confirmed_patient_id ?? selected.suggested_patient_id;
          if (!patientId) {
            setFeedback({ tone: "err", message: "No suggested patient to confirm." });
            return;
          }
          body.patient_id = patientId;
        }
        if (action === "suggest") {
          body.extracted_patient_name = selected.extracted_patient_name;
          body.extracted_dob = selected.extracted_dob;
          body.extracted_mrn = selected.extracted_mrn;
        }

        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId)}/pathology-inbox/${encodeURIComponent(selected.id)}/match`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          document?: PathologyInboundDocumentListItem;
        };
        if (!res.ok || json.ok !== true || !json.document) {
          setFeedback({
            tone: "err",
            message: typeof json.error === "string" ? json.error : `Match update failed (${res.status}).`,
          });
          return;
        }
        patchDocument(json.document);
        setFeedback({
          tone: "ok",
          message:
            action === "confirm"
              ? "Patient match confirmed."
              : action === "reject"
                ? "Document rejected."
                : "Match suggestion refreshed.",
        });
        router.refresh();
      } catch {
        setFeedback({ tone: "err", message: "Network error during match update." });
      }
    });
  }

  function onPromote(status: "draft" | "reviewed") {
    if (!canMutate || !selected) return;
    setFeedback(null);
    start(async () => {
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId)}/pathology-inbox/${encodeURIComponent(selected.id)}/promote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          document?: PathologyInboundDocumentListItem;
          pathology_result_id?: string;
        };
        if (!res.ok || json.ok !== true || !json.document) {
          setFeedback({
            tone: "err",
            message: typeof json.error === "string" ? json.error : `Promote failed (${res.status}).`,
          });
          return;
        }
        patchDocument(json.document);
        setFeedback({
          tone: "ok",
          message:
            status === "reviewed"
              ? "Promoted as reviewed pathology result."
              : "Promoted as draft pathology result.",
        });
        if (json.pathology_result_id && selected.confirmed_patient_id) {
          router.push(
            `/fi-admin/${tenantId}/patients/${selected.confirmed_patient_id}/blood-results/${json.pathology_result_id}`
          );
        }
        router.refresh();
      } catch {
        setFeedback({ tone: "err", message: "Network error during promotion." });
      }
    });
  }

  function onExtract() {
    if (!canMutate || !selected || !extractionEnabled) return;
    setFeedback(null);
    start(async () => {
      try {
        const job = selected.extraction_job;
        const useRetry =
          job?.id &&
          (selected.extraction_status === "failed" ||
            selected.extraction_status === "succeeded" ||
            selected.extraction_status === "needs_review");

        const url = useRetry
          ? `/api/tenants/${encodeURIComponent(tenantId)}/pathology-extraction-jobs/${encodeURIComponent(job!.id)}/retry`
          : `/api/tenants/${encodeURIComponent(tenantId)}/pathology-inbox/${encodeURIComponent(selected.id)}/extract`;

        const json = await postJson<{ document?: PathologyInboundDocumentListItem }>(url);
        if (json.ok !== true || !json.document) {
          setFeedback({
            tone: "err",
            message: typeof json.error === "string" ? json.error : "Extraction failed.",
          });
          return;
        }
        patchDocument(json.document);
        setFeedback({ tone: "ok", message: useRetry ? "Extraction retried." : "Extraction completed." });
        router.refresh();
      } catch {
        setFeedback({ tone: "err", message: "Network error during extraction." });
      }
    });
  }

  function onCreateDraft() {
    if (!canMutate || !selected) return;
    setFeedback(null);
    start(async () => {
      try {
        const json = await postJson<{
          document?: PathologyInboundDocumentListItem;
          pathology_result_id?: string;
        }>(
          `/api/tenants/${encodeURIComponent(tenantId)}/pathology-inbox/${encodeURIComponent(selected.id)}/create-draft`,
          {}
        );
        if (json.ok !== true || !json.document) {
          setFeedback({
            tone: "err",
            message: typeof json.error === "string" ? json.error : "Create draft failed.",
          });
          return;
        }
        patchDocument(json.document);
        setFeedback({ tone: "ok", message: "Draft pathology result created from extraction." });
        if (json.pathology_result_id && selected.confirmed_patient_id) {
          router.push(
            `/fi-admin/${tenantId}/patients/${selected.confirmed_patient_id}/blood-results/${json.pathology_result_id}`
          );
        }
        router.refresh();
      } catch {
        setFeedback({ tone: "err", message: "Network error during draft creation." });
      }
    });
  }

  function onDismissExtraction() {
    if (!canMutate || !selected?.extraction_job?.id) return;
    setFeedback(null);
    start(async () => {
      try {
        const json = await postJson<{ job?: { review_status?: string } }>(
          `/api/tenants/${encodeURIComponent(tenantId)}/pathology-extraction-jobs/${encodeURIComponent(selected.extraction_job!.id)}/dismiss`
        );
        if (json.ok !== true) {
          setFeedback({
            tone: "err",
            message: typeof json.error === "string" ? json.error : "Dismiss failed.",
          });
          return;
        }
        router.refresh();
        setFeedback({ tone: "ok", message: "Extraction dismissed." });
      } catch {
        setFeedback({ tone: "err", message: "Network error during dismiss." });
      }
    });
  }

  const canCreateDraft =
    selected &&
    selected.match_status === "matched" &&
    !selected.draft_result_id &&
    selected.extraction_job &&
    selected.extraction_job.review_status !== "dismissed" &&
    (selected.extraction_status === "succeeded" || selected.extraction_status === "needs_review");

  return (
    <div className="space-y-6">
      {canMutate ? (
        <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-slate-100">Upload inbound PDF</h2>
          <p className="mt-1 text-xs text-slate-500">
            {extractionEnabled
              ? "Upload triggers automatic marker extraction when PATHOLOGY_EXTRACTION_ENABLED is on. eFax/email ingestion is not enabled."
              : "Manual upload for lab PDFs awaiting patient match. OCR extraction is disabled (PATHOLOGY_EXTRACTION_ENABLED=false)."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-300">PDF file</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="mt-1 block w-full text-sm text-slate-300"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Patient name hint (optional)</span>
              <input
                type="text"
                className="mt-1 w-full rounded border border-slate-700 bg-transparent px-2 py-1.5 text-sm"
                value={extractedName}
                onChange={(e) => setExtractedName(e.target.value)}
                placeholder="For match suggestion"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">DOB hint (optional)</span>
              <input
                type="date"
                className="mt-1 w-full rounded border border-slate-700 bg-transparent px-2 py-1.5 text-sm"
                value={extractedDob}
                onChange={(e) => setExtractedDob(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || !file}
              onClick={onUpload}
              className={fiOsChromeClasses.toolbarControlSurface + " px-4 py-2 text-sm font-semibold"}
            >
              Upload to inbox
            </button>
          </div>
        </section>
      ) : null}

      {feedback ? (
        <p
          className={
            feedback.tone === "ok" ? "text-sm text-emerald-300/90" : "text-sm text-rose-300/90"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Pending document queue</h2>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Status
            <select
              className="rounded border border-slate-700 bg-[#0a101f] px-2 py-1 text-sm text-slate-100"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as PathologyInboundMatchStatus | "all")
              }
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="rejected">Rejected</option>
              <option value="promoted">Promoted</option>
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <FiOsEmptyState
            title="No inbound pathology documents"
            description="Upload a lab PDF to start the inbox workflow."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0F1629]/80">
              <table className="min-w-full text-xs text-slate-300">
                <thead className="border-b border-white/[0.06] text-left text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Received</th>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2">Extraction</th>
                    <th className="px-3 py-2">Markers</th>
                    <th className="px-3 py-2">Suggested patient</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <tr
                      key={doc.id}
                      className={
                        "cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03] " +
                        (selected?.id === doc.id ? "bg-cyan-500/10" : "")
                      }
                      onClick={() => setSelectedId(doc.id)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{formatWhen(doc.created_at)}</td>
                      <td className="px-3 py-2 font-medium text-slate-100">
                        {doc.original_filename ?? "inbound.pdf"}
                      </td>
                      <td className="px-3 py-2">{STATUS_LABELS[doc.match_status]}</td>
                      <td className="px-3 py-2">{EXTRACTION_STATUS_LABELS[doc.extraction_status]}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {doc.extraction_job?.extracted_marker_count ?? "—"}
                      </td>
                      <td className="px-3 py-2">{doc.suggested_patient_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected ? (
              <aside className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 space-y-4">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Selected document
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-100">
                    {selected.original_filename ?? "inbound.pdf"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {STATUS_LABELS[selected.match_status]} · Extraction:{" "}
                    {EXTRACTION_STATUS_LABELS[selected.extraction_status]}
                  </p>
                </div>

                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Extracted name</dt>
                    <dd className="text-slate-200">{selected.extracted_patient_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Suggested patient</dt>
                    <dd className="text-slate-200">{selected.suggested_patient_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Confirmed patient</dt>
                    <dd className="text-slate-200">{selected.confirmed_patient_name ?? "—"}</dd>
                  </div>
                </dl>

                {selected.extraction_job ? (
                  <div className="space-y-2 border-t border-white/[0.06] pt-4 text-xs">
                    <p className="font-semibold text-slate-300">Extraction</p>
                    <dl className="grid grid-cols-2 gap-2">
                      <div>
                        <dt className="text-slate-500">Provider</dt>
                        <dd className="text-slate-200">{selected.extraction_job.provider ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">OCR confidence</dt>
                        <dd className="text-slate-200 tabular-nums">
                          {confidenceLabel(
                            typeof selected.extraction_job.raw_extraction_json?.ocr_confidence ===
                              "number"
                              ? selected.extraction_job.raw_extraction_json.ocr_confidence
                              : null
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Extracted markers</dt>
                        <dd className="text-slate-200 tabular-nums">
                          {selected.extraction_job.extracted_marker_count}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Skipped markers</dt>
                        <dd className="text-slate-200 tabular-nums">
                          {selected.extraction_job.skipped_marker_count}
                        </dd>
                      </div>
                    </dl>
                    {selected.extraction_job.error_message ? (
                      <p className="text-rose-300/90">{selected.extraction_job.error_message}</p>
                    ) : null}
                    {selectedMarkers.length > 0 ? (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded border border-white/[0.06]">
                        <table className="min-w-full text-[0.65rem]">
                          <thead className="sticky top-0 bg-[#0a101f] text-slate-500">
                            <tr>
                              <th className="px-2 py-1 text-left">Marker</th>
                              <th className="px-2 py-1 text-left">Value</th>
                              <th className="px-2 py-1 text-left">Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedMarkers.slice(0, 12).map((m) => (
                              <tr key={m.test_label} className="border-t border-white/[0.04]">
                                <td className="px-2 py-1">{m.test_label}</td>
                                <td className="px-2 py-1 tabular-nums">
                                  {m.result_value}
                                  {m.result_unit ? ` ${m.result_unit}` : ""}
                                </td>
                                <td className="px-2 py-1">{m.flag}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {selectedMiCount > 0 ? (
                      <p className="text-slate-400">
                        Medical intelligence preview: {selectedMiCount} interpreted marker
                        {selectedMiCount === 1 ? "" : "s"} (clinician review required).
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {canMutate && extractionEnabled ? (
                  <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={onExtract}
                      className={fiOsChromeClasses.toolbarControlSurface + " px-3 py-1.5 text-xs font-semibold"}
                    >
                      {selected.extraction_status === "not_started" ? "Run extraction" : "Retry extraction"}
                    </button>
                    {selected.extraction_job?.id &&
                    selected.extraction_job.review_status !== "dismissed" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={onDismissExtraction}
                        className={
                          fiOsChromeClasses.toolbarControlSurface +
                          " px-3 py-1.5 text-xs font-semibold text-rose-200/90"
                        }
                      >
                        Dismiss extraction
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {canMutate && selected.match_status !== "promoted" && selected.match_status !== "rejected" ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.suggested_patient_id ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onMatchAction("confirm")}
                        className={fiOsChromeClasses.toolbarControlSurface + " px-3 py-1.5 text-xs font-semibold"}
                      >
                        Confirm match
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onMatchAction("suggest")}
                      className={fiOsChromeClasses.toolbarControlSurface + " px-3 py-1.5 text-xs font-semibold"}
                    >
                      Refresh suggestion
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onMatchAction("reject")}
                      className={
                        fiOsChromeClasses.toolbarControlSurface +
                        " px-3 py-1.5 text-xs font-semibold text-rose-200/90"
                      }
                    >
                      Reject
                    </button>
                  </div>
                ) : null}

                {canMutate && canCreateDraft ? (
                  <div className="space-y-2 border-t border-white/[0.06] pt-4">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={onCreateDraft}
                      className={
                        fiOsChromeClasses.toolbarControlSurface +
                        " " +
                        fiOsChromeClasses.toolbarPrimaryAccent +
                        " px-3 py-1.5 text-xs font-semibold"
                      }
                    >
                      Create draft result
                    </button>
                  </div>
                ) : null}

                {selected.draft_result_id && selected.confirmed_patient_id ? (
                  <Link
                    href={`/fi-admin/${tenantId}/patients/${selected.confirmed_patient_id}/blood-results/${selected.draft_result_id}`}
                    className="inline-block text-xs font-medium text-cyan-400/95 hover:text-cyan-300"
                  >
                    Open draft result →
                  </Link>
                ) : null}

                {canMutate && selected.match_status === "matched" ? (
                  <div className="space-y-2 border-t border-white/[0.06] pt-4">
                    <p className="text-xs text-slate-400">
                      Manual promotion (works even when extraction fails)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onPromote("draft")}
                        className={fiOsChromeClasses.toolbarControlSurface + " px-3 py-1.5 text-xs font-semibold"}
                      >
                        Promote as draft
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onPromote("reviewed")}
                        className={
                          fiOsChromeClasses.toolbarControlSurface +
                          " px-3 py-1.5 text-xs font-semibold"
                        }
                      >
                        Promote as reviewed
                      </button>
                    </div>
                  </div>
                ) : null}

                {selected.promoted_result_id && selected.confirmed_patient_id ? (
                  <Link
                    href={`/fi-admin/${tenantId}/patients/${selected.confirmed_patient_id}/blood-results/${selected.promoted_result_id}`}
                    className="inline-block text-xs font-medium text-cyan-400/95 hover:text-cyan-300"
                  >
                    Open promoted result →
                  </Link>
                ) : null}
              </aside>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
