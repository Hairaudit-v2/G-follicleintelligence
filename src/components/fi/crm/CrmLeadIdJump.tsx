"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CrmLeadIdJump({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const base = `/fi-admin/${tenantId}/crm`;

  function go(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`${base}/leads/${trimmed}`);
  }

  return (
    <form onSubmit={go} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="crm-lead-id" className="mb-1 block text-xs font-medium text-slate-400">
          Lead UUID
        </label>
        <input
          id="crm-lead-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="00000000-0000-4000-8000-000000000000"
          className="w-72 max-w-full rounded border border-slate-700 px-2 py-1.5 font-mono text-sm"
        />
      </div>
      <button type="submit" className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900">
        Open lead
      </button>
    </form>
  );
}
