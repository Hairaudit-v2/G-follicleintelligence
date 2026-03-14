"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type QueueItem = {
  report_id: string;
  case_id: string;
  version: number;
  report_status: string;
  created_at: string;
  patient: { full_name: string; email: string } | null;
};

export default function AuditQueuePage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/fi/audit/queue?tenant_id=${encodeURIComponent(tenantId)}`)
      .then((r) => r.json())
      .then((d) => d.ok && setQueue(d.queue ?? []))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-medium">Audit queue</h2>

      {queue.length === 0 ? (
        <p className="text-gray-500">No reports awaiting audit.</p>
      ) : (
        <table className="w-full text-sm border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left">Report</th>
              <th className="border border-gray-200 px-2 py-1 text-left">Patient</th>
              <th className="border border-gray-200 px-2 py-1 text-left">Status</th>
              <th className="border border-gray-200 px-2 py-1 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => (
              <tr key={q.report_id}>
                <td className="border border-gray-200 px-2 py-1">
                  <Link
                    href={`/fi-admin/${tenantId}/audit/${q.report_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {q.report_id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="border border-gray-200 px-2 py-1">
                  {q.patient?.full_name ?? "—"} ({q.patient?.email ?? "—"})
                </td>
                <td className="border border-gray-200 px-2 py-1">{q.report_status}</td>
                <td className="border border-gray-200 px-2 py-1">
                  {new Date(q.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
