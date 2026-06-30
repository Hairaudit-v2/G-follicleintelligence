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

type ActionResult = { ok: boolean; error?: string };

async function parseJsonResponse<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(res.ok ? "Invalid response from server." : `Request failed (${res.status}).`);
  }
}

export default function AuditReviewPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ReportData["report"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!tenantId || !reportId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetch(
      `/api/fi/report?tenant_id=${encodeURIComponent(tenantId)}&report_id=${encodeURIComponent(reportId)}`
    )
      .then((r) => parseJsonResponse<ReportData>(r))
      .then((d) => {
        if (cancelled) return;
        if (d.ok && d.report) {
          setReport(d.report);
        } else {
          setLoadError(d.error ?? "Report not found or access denied.");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Could not load report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, reportId]);

  const approve = () => {
    setApproving(true);
    setActionError(null);
    fetch("/api/fi/audit/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, report_id: reportId }),
    })
      .then((r) => parseJsonResponse<ActionResult>(r))
      .then((d) => {
        if (d.ok) window.location.href = `/fi-admin/${tenantId}/audit`;
        else setActionError(d.error ?? "Approve failed.");
      })
      .catch((e: unknown) => {
        setActionError(e instanceof Error ? e.message : "Approve request failed.");
      })
      .finally(() => setApproving(false));
  };

  const reject = () => {
    if (!rejectNote.trim()) {
      setActionError("Rejection note is required.");
      return;
    }
    setRejecting(true);
    setActionError(null);
    fetch("/api/fi/audit/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        report_id: reportId,
        note: rejectNote.trim(),
      }),
    })
      .then((r) => parseJsonResponse<ActionResult>(r))
      .then((d) => {
        if (d.ok) window.location.href = `/fi-admin/${tenantId}/audit`;
        else setActionError(d.error ?? "Reject failed.");
      })
      .catch((e: unknown) => {
        setActionError(e instanceof Error ? e.message : "Reject request failed.");
      })
      .finally(() => setRejecting(false));
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;

  if (loadError) {
    return (
      <div className="space-y-3">
        <Link
          href={`/fi-admin/${tenantId}/audit`}
          className="text-sm text-slate-400 hover:underline"
        >
          ← Audit queue
        </Link>
        <p className="text-sm text-rose-300" role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/fi-admin/${tenantId}/audit`}
          className="text-sm text-slate-400 hover:underline"
        >
          ← Audit queue
        </Link>
        <h2 className="text-base font-medium">
          Audit report {reportId.slice(0, 8)}… · {report?.status ?? "—"}
        </h2>
      </div>

      {actionError ? (
        <p className="text-sm text-rose-300" role="alert">
          {actionError}
        </p>
      ) : null}

      {report?.report_json ? (
        <>
          <ReportPreview
            report={report.report_json as Parameters<typeof ReportPreview>[0]["report"]}
          />

          <div className="flex gap-4 items-start border-t border-white/[0.08] pt-4">
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
