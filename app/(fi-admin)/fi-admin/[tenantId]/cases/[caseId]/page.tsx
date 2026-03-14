"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReportPreview } from "@/components/fi/ReportPreview";

type CaseDetail = {
  case: { id: string; status: string; external_id: string | null; created_at: string };
  intake: { full_name: string; email: string; dob: string; sex: string; country: string | null; primary_concern: string | null } | null;
  uploads: Array<{ id: string; type: string; filename: string; storage_path: string; created_at: string }>;
  blood_signals: { markers?: Array<{ name: string; value: unknown; unit?: string }> } | null;
  image_signals: Array<{ payload?: { filename?: string; signals?: unknown } }>;
  scorecard: { overall_score?: number; risk_tier?: string; payload?: unknown } | null;
  latest_report: { id: string; version: number; status: string; report_json?: unknown } | null;
};

export default function CaseDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const caseId = params.caseId as string;
  const [data, setData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!tenantId || !caseId) return;
    fetch(`/api/tenants/${tenantId}/cases/${caseId}`)
      .then((r) => r.json())
      .then((d) => d.ok && setData(d))
      .finally(() => setLoading(false));
  }, [tenantId, caseId]);

  const submit = () => {
    setSubmitting(true);
    fetch(`/api/tenants/${tenantId}/cases/${caseId}/submit`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setData((prev) => prev ? { ...prev, case: { ...prev.case, status: "submitted" } } : null) : alert(d.error)))
      .finally(() => setSubmitting(false));
  };

  const runModel = () => {
    setRunning(true);
    fetch(`/api/tenants/${tenantId}/cases/${caseId}/run-model`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setTimeout(() => {
            fetch(`/api/tenants/${tenantId}/cases/${caseId}`)
              .then((r) => r.json())
              .then((res) => res.ok && setData(res));
          }, 2000);
        } else alert(d.error ?? "Failed");
      })
      .finally(() => setRunning(false));
  };

  if (loading || !data) return <p className="text-gray-500">Loading…</p>;

  const latestReportJson = data.latest_report?.report_json;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/fi-admin/${tenantId}/cases`} className="text-sm text-gray-600 hover:underline">
          ← Cases
        </Link>
        <h2 className="text-base font-medium">
          Case {data.case.id.slice(0, 8)}… · {data.case.status}
        </h2>
      </div>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium mb-2">Intake</h3>
        {data.intake ? (
          <dl className="text-sm grid grid-cols-2 gap-1">
            <dt className="text-gray-500">Name</dt>
            <dd>{data.intake.full_name}</dd>
            <dt className="text-gray-500">Email</dt>
            <dd>{data.intake.email}</dd>
            <dt className="text-gray-500">DOB</dt>
            <dd>{data.intake.dob}</dd>
            <dt className="text-gray-500">Sex</dt>
            <dd>{data.intake.sex}</dd>
          </dl>
        ) : (
          <p className="text-gray-500">No intake</p>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium mb-2">Uploads ({data.uploads.length})</h3>
        {data.uploads.length === 0 ? (
          <p className="text-gray-500 text-sm">No uploads. Use the upload form below.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {data.uploads.map((u) => (
              <li key={u.id}>
                <span className="font-mono">{u.type}</span>: {u.filename}
              </li>
            ))}
          </ul>
        )}
        <UploadForm tenantId={tenantId} caseId={caseId} onUpload={() => {
          fetch(`/api/tenants/${tenantId}/cases/${caseId}`)
            .then((r) => r.json())
            .then((d) => d.ok && setData(d));
        }} />
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium mb-2">Signals</h3>
        <p className="text-sm text-gray-500">
          Blood: {data.blood_signals?.markers?.length ?? 0} markers.
          Image: {data.image_signals?.length ?? 0} signals.
        </p>
      </section>

      {data.scorecard && (
        <section className="rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium mb-2">Scorecard</h3>
          <p className="text-sm">
            Overall: {((data.scorecard.overall_score ?? 0) * 10).toFixed(1)}/10 · Tier: {data.scorecard.risk_tier ?? "—"}
          </p>
          {Boolean(data.scorecard.payload) && (
            <pre className="mt-2 text-xs overflow-auto max-h-40 rounded bg-gray-100 p-2">
              {JSON.stringify(data.scorecard.payload, null, 2)}
            </pre>
          )}
        </section>
      )}

      {Boolean(latestReportJson) && (
        <section>
          <h3 className="text-sm font-medium mb-2">Report preview</h3>
          <ReportPreview report={latestReportJson as Parameters<typeof ReportPreview>[0]["report"]} />
        </section>
      )}

      <div className="flex gap-2">
        {["draft", "submitted"].includes(data.case.status) && (
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-gray-700 text-white px-3 py-1 text-sm disabled:opacity-50"
          >
            {submitting ? "…" : "Submit"}
          </button>
        )}
        {["submitted"].includes(data.case.status) && (
          <button
            onClick={runModel}
            disabled={running}
            className="rounded bg-green-700 text-white px-3 py-1 text-sm disabled:opacity-50"
          >
            {running ? "Running…" : "Run model"}
          </button>
        )}
        {data.latest_report?.status === "draft" && (
          <Link
            href={`/fi-admin/${tenantId}/audit/${data.latest_report.id}`}
            className="rounded bg-amber-600 text-white px-3 py-1 text-sm inline-block"
          >
            Audit report
          </Link>
        )}
      </div>
    </div>
  );
}

function UploadForm({
  tenantId,
  caseId,
  onUpload,
}: {
  tenantId: string;
  caseId: string;
  onUpload: () => void;
}) {
  const [type, setType] = useState("blood_pdf");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const doUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("case_id", caseId);
    fd.set("type", type);
    fd.append("files", file);
    setUploading(true);
    fetch("/api/fi/uploads", { method: "POST", body: fd })
      .then((r) => r.json())
      .then((d) => (d.ok ? (onUpload(), setFile(null)) : alert(d.error)))
      .finally(() => setUploading(false));
  };

  return (
    <form onSubmit={doUpload} className="mt-3 flex gap-2 items-center text-sm">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded border px-2 py-1"
      >
        <option value="blood_pdf">blood_pdf</option>
        <option value="blood_csv">blood_csv</option>
        <option value="scalp_preop_front">scalp_preop_front</option>
      </select>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <button type="submit" disabled={!file || uploading} className="rounded border px-2 py-1 disabled:opacity-50">
        {uploading ? "…" : "Upload"}
      </button>
    </form>
  );
}
