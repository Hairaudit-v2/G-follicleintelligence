"use client";

import { useState, useTransition } from "react";

import { createFinanceProviderAction } from "@/lib/actions/financial-os-finance-actions";

const PROVIDER_TYPES = [
  { value: "medical_financing", label: "Medical financing" },
  { value: "bnpl", label: "Buy now pay later" },
  { value: "super_release", label: "Super release" },
  { value: "international_financing", label: "International financing" },
  { value: "custom", label: "Custom" },
] as const;

export function FinancialProviderForm(props: { tenantId: string; canMutate: boolean }) {
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<(typeof PROVIDER_TYPES)[number]["value"]>("custom");
  const [countryCode, setCountryCode] = useState("AU");
  const [isActive, setIsActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className="text-xs text-slate-600">Finance or manager role required to manage financing providers.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await createFinanceProviderAction(props.tenantId, {
        name: name.trim(),
        provider_type: providerType,
        country_code: countryCode.trim() || null,
        is_active: isActive,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setName("");
      setMsg("Provider created.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Add tenant provider</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="block text-xs text-slate-600">
          Type
          <select
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as (typeof PROVIDER_TYPES)[number]["value"])}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            {PROVIDER_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600">
          Country code
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active for new applications
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create provider"}
        </button>
        {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
      </div>
    </form>
  );
}
