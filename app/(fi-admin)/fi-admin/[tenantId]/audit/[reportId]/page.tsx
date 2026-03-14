"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReportPreview } from "@/components/fi/ReportPreview";

type ReportData = {
  ok: boolean;
  report?: {
    id: string;
    version: number;
    status: string;
    report_json: unknown;
    case_id?: string;
  };
  error?: string;
};

export default function AuditReviewPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ReportData["report"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!tenantId || !reportId) return;
    fetch(`/api/fi/report?tenant_id=${encodeURIComponent(tenantId)}&report_id=${encodeURIComponent(reportId)}`)
      .then((r) => r.json())
      .then((d: ReportData) => {
        if (d.ok && d.report) setReport(d.report);
      })
      .finally(() => setLoading(false));
  }, [tenantId, reportId]);

  const approve = () => {
    setApproving(true);
    fetch("/api/fi/audit/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, report_id: reportId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) window.location.href = `/fi-admin/${tenantId}/audit`;
        else alert(d.error ?? "Failed");
      })
      .finally(() => setApproving(false));
  };

  const reject = () => {
    if (!rejectNote.trim()) {
      alert("Note is required");
      return;
    }
    setRejecting(true);
    fetch("/api/fi/audit/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        report_id: reportId,
        note: rejectNote.trim(),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) window.location.href = `/fi-admin/${tenantId}/audit`;
        else alert(d.error ?? "Failed");
      })
      .finally(() => setRejecting(false));
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/fi-admin/${tenantId}/audit`} className="text-sm text-gray-600 hover:underline">
          ← Audit queue
        </Link>
        <h2 className="text-base font-medium">
          Audit report {reportId.slice(0, 8)}… · {report?.status ?? "—"}
        </h2>
      </div>

      {report?.report_json ? (
        <>
          <ReportPreview report={report.report_json as Parameters<typeof ReportPreview>[0]["report"]} />

          <div className="flex gap-4 items-start border-t border-gray-200 pt-4">
            <button
              onClick={approve}
              disabled={approving || report.status === "released"}
              className="rounded bg-green-700 text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {approving ? "…" : "Approve & issue"}
            </button>

            <div className="flex flex-col gap-2">
              <input
                placeholder="Rejection note (required)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="rounded border px-2 py-1 text-sm w-64"
              />
              <button
                onClick={reject}
                disabled={rejecting || report.status === "released"}
                className="rounded bg-red-600 text-white px-4 py-2 text-sm disabled:opacity-50 w-fit"
              >
                {rejecting ? "…" : "Reject"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500">Report not found or no report_json.</p>
      )}
    </div>
  );
}
