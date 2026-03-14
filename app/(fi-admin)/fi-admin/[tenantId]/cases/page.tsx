"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type CaseRow = {
  id: string;
  external_id: string | null;
  status: string;
  partner_id: string | null;
  created_at: string;
  intake: { full_name: string; email: string } | null;
};

export default function CasesPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", dob: "", sex: "", primary_concern: "", country: "" });

  useEffect(() => {
    if (!tenantId || typeof tenantId !== "string") return;
    const url = statusFilter
      ? `/api/tenants/${tenantId}/cases?status=${encodeURIComponent(statusFilter)}`
      : `/api/tenants/${tenantId}/cases`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCases(d.cases ?? []);
      })
      .finally(() => setLoading(false));
  }, [tenantId, statusFilter]);

  const createCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    fetch(`/api/tenants/${tenantId}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const name = form.full_name;
          const email = form.email;
          setForm({ full_name: "", email: "", dob: "", sex: "", primary_concern: "", country: "" });
          setCases((prev) => [
            {
              id: d.case.id,
              external_id: null,
              status: d.case.status,
              partner_id: null,
              created_at: d.case.created_at,
              intake: { full_name: name, email },
            } as CaseRow,
            ...prev,
          ]);
        } else alert(d.error ?? "Failed");
      })
      .catch(() => alert("Failed"));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-medium">Cases</h2>

      <form onSubmit={createCase} className="rounded border border-gray-200 bg-white p-4 space-y-3 max-w-lg">
        <h3 className="text-sm font-medium">Create case</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="rounded border px-2 py-1"
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded border px-2 py-1"
            required
          />
          <input
            placeholder="DOB (YYYY-MM-DD)"
            value={form.dob}
            onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
            className="rounded border px-2 py-1"
            required
          />
          <input
            placeholder="Sex"
            value={form.sex}
            onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
            className="rounded border px-2 py-1"
            required
          />
          <input
            placeholder="Country"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            className="rounded border px-2 py-1 col-span-2"
          />
        </div>
        <button type="submit" className="rounded bg-gray-800 text-white px-3 py-1 text-sm">
          Create
        </button>
      </form>

      <div className="flex gap-2 items-center text-sm">
        <label>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">All</option>
          <option value="draft">draft</option>
          <option value="submitted">submitted</option>
          <option value="processing">processing</option>
          <option value="complete">complete</option>
          <option value="failed">failed</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : cases.length === 0 ? (
        <p className="text-gray-500">No cases.</p>
      ) : (
        <table className="w-full text-sm border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left">Case</th>
              <th className="border border-gray-200 px-2 py-1 text-left">Patient</th>
              <th className="border border-gray-200 px-2 py-1 text-left">Status</th>
              <th className="border border-gray-200 px-2 py-1 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td className="border border-gray-200 px-2 py-1">
                  <Link href={`/fi-admin/${tenantId}/cases/${c.id}`} className="text-blue-600 hover:underline">
                    {c.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="border border-gray-200 px-2 py-1">
                  {c.intake?.full_name ?? "—"} ({c.intake?.email ?? "—"})
                </td>
                <td className="border border-gray-200 px-2 py-1">{c.status}</td>
                <td className="border border-gray-200 px-2 py-1">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
