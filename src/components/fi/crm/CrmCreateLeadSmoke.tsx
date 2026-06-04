"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { crmCreateLeadAction } from "@/lib/actions/fi-crm-actions";

export function CrmCreateLeadSmoke({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [personId, setPersonId] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const pid = personId.trim();
      const body: Record<string, unknown> = {};
      if (adminKey.trim()) body.adminKey = adminKey.trim();
      if (pid) {
        body.personId = pid;
      } else if (email.trim()) {
        body.person = {
          email: email.trim(),
          ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
        };
      } else {
        setMsg("Enter an existing person UUID or an email for a new person.");
        setBusy(false);
        return;
      }
      const r = await crmCreateLeadAction(tenantId, body);
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setMsg(`Created lead ${r.lead.id}.`);
      router.push(`/fi-admin/${tenantId}/crm/leads/${r.lead.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border border-dashed border-amber-300 bg-amber-50/50 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-900">Smoke: create lead</h2>
      <p className="mb-3 text-xs text-amber-800">Internal only — uses gated server action. Provide either person UUID (tenant-scoped) or person email for resolution.</p>
      <form onSubmit={onSubmit} className="grid max-w-xl gap-3 text-sm">
        <label className="block">
          <span className="text-xs text-gray-600">FI admin key (optional, same as Configuration)</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Existing person UUID</span>
          <input
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="mt-0.5 w-full font-mono text-xs"
            placeholder="person id"
          />
        </label>
        <p className="text-center text-xs text-gray-500">— or new person —</p>
        <label className="block">
          <span className="text-xs text-gray-600">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Display name (optional)</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create lead"}
        </button>
        {msg ? <p className="text-sm text-gray-800">{msg}</p> : null}
      </form>
    </section>
  );
}
