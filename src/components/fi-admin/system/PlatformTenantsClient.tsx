"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createPlatformTenantAction } from "@/lib/actions/fi-platform-tenant-actions";

export function PlatformTenantsClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [timezone, setTimezone] = useState("Australia/Perth");
  const [adminEmail, setAdminEmail] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createPlatformTenantAction({
        tenantName,
        tenantSlug,
        defaultClinicDisplayName: clinicName,
        defaultTimezone: timezone,
        firstTenantAdminEmail: adminEmail,
        supportEmail: supportEmail.trim() ? supportEmail.trim() : null,
      });
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      setMessage({ kind: "ok", text: `Tenant created. Open /fi-admin/${res.tenantId}` });
      setTenantName("");
      setTenantSlug("");
      setClinicName("");
      setAdminEmail("");
      setSupportEmail("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-200">Create tenant</h2>
      <p className="mt-1 text-xs text-slate-500">
        Seeds default feature flags and branding in{" "}
        <code className="text-slate-400">fi_tenants.config_json</code>,{" "}
        <code className="text-slate-400">fi_tenant_settings</code>, one{" "}
        <code className="text-slate-400">fi_clinics</code> row, and a{" "}
        <code className="text-slate-400">clinic_admin</code> tenant backend user (invite if they
        have no Supabase account yet).
      </p>

      {message ? (
        <p
          className={
            message.kind === "ok" ? "mt-3 text-sm text-emerald-400" : "mt-3 text-sm text-red-400"
          }
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-400">Organisation / tenant name</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={tenantName}
            onChange={(ev) => setTenantName(ev.target.value)}
            autoComplete="organization"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">URL slug</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={tenantSlug}
            onChange={(ev) => setTenantSlug(ev.target.value.toLowerCase())}
            placeholder="acme-clinic"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Lowercase letters, digits, and hyphens only"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Default clinic display name</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={clinicName}
            onChange={(ev) => setClinicName(ev.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Default timezone (IANA)</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={timezone}
            onChange={(ev) => setTimezone(ev.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-400">First tenant admin email</span>
          <input
            required
            type="email"
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={adminEmail}
            onChange={(ev) => setAdminEmail(ev.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-400">
            Support email (optional — defaults to support@&lt;slug&gt;.local)
          </span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={supportEmail}
            onChange={(ev) => setSupportEmail(ev.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create tenant"}
          </button>
        </div>
      </form>
    </section>
  );
}
