"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOnboardingSessionAction } from "@/lib/actions/fi-onboarding-os-provisioning-actions";
import {
  buildDefaultModuleTemplate,
  buildTenantSlug,
  listAvailableModuleCodesForProvisioning,
} from "@/src/lib/onboarding-os/tenantProvisioningCore";
import { FI_MODULE_DISPLAY_NAMES } from "@/src/lib/platform/entitlements/modules";

const DEFAULT_MODULES = buildDefaultModuleTemplate().enabledModules;

export function OnboardingNewSessionClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [timezone, setTimezone] = useState("Australia/Perth");
  const [adminEmail, setAdminEmail] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [enabledModules, setEnabledModules] = useState<string[]>([...DEFAULT_MODULES]);

  const moduleCodes = listAvailableModuleCodesForProvisioning();

  function onTenantNameChange(value: string) {
    setTenantName(value);
    if (!slugTouched) {
      setTenantSlug(buildTenantSlug(value));
    }
    if (!clinicName) {
      setClinicName(value);
    }
  }

  function toggleModule(code: string) {
    setEnabledModules((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createOnboardingSessionAction({
        tenantName,
        tenantSlug,
        defaultClinicDisplayName: clinicName,
        defaultTimezone: timezone,
        firstTenantAdminEmail: adminEmail,
        supportEmail: supportEmail.trim() ? supportEmail.trim() : null,
        enabledModuleCodes: enabledModules,
      });
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      router.push(`/fi-admin/platform/onboarding/${res.sessionId}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-200">New provisioning session</h2>
      <p className="mt-1 text-xs text-slate-500">
        Phase A foundation — tracks tenant provisioning steps. No Stripe billing or external CRM connectors yet.
      </p>

      {message ? (
        <p className={message.kind === "ok" ? "mt-3 text-sm text-emerald-400" : "mt-3 text-sm text-red-400"} role="status">
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
            onChange={(ev) => onTenantNameChange(ev.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">URL slug</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={tenantSlug}
            onChange={(ev) => {
              setSlugTouched(true);
              setTenantSlug(ev.target.value.toLowerCase());
            }}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
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
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-400">Support email (optional)</span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={supportEmail}
            onChange={(ev) => setSupportEmail(ev.target.value)}
          />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-medium text-slate-400">Modules to enable (trialing — no Stripe)</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {moduleCodes.map((code) => (
              <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#030810]/60 px-3 py-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={enabledModules.includes(code)}
                  onChange={() => toggleModule(code)}
                  className="rounded border-white/20"
                />
                <span>{FI_MODULE_DISPLAY_NAMES[code as keyof typeof FI_MODULE_DISPLAY_NAMES] ?? code}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create session"}
          </button>
          <Link
            href="/fi-admin/platform/onboarding"
            className="rounded-lg border border-white/[0.12] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
