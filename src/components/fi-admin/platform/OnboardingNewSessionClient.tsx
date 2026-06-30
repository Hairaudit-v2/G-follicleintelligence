"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createOnboardingSessionAction } from "@/lib/actions/fi-onboarding-os-provisioning-actions";
import { listClinicDeploymentTemplateSummaries } from "@/src/lib/onboarding-os/clinicDeploymentCatalog";
import {
  buildClinicDeploymentTemplate,
  buildTenantSlug,
  calculateTemplateReadiness,
  listAvailableModuleCodesForProvisioning,
  resolveModuleBundle,
  resolveRolePack,
} from "@/src/lib/onboarding-os/tenantProvisioningCore";
import type { ClinicDeploymentTemplateCode } from "@/src/lib/onboarding-os/tenantProvisioningTypes";
import { FI_MODULE_DISPLAY_NAMES } from "@/src/lib/platform/entitlements/modules";

const TEMPLATE_OPTIONS = listClinicDeploymentTemplateSummaries();
const DEFAULT_TEMPLATE: ClinicDeploymentTemplateCode = "standard_hair_restoration";

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
  const [deploymentTemplateCode, setDeploymentTemplateCode] =
    useState<ClinicDeploymentTemplateCode>(DEFAULT_TEMPLATE);
  const [modulesTouched, setModulesTouched] = useState(false);
  const [sandboxSeedEnabled, setSandboxSeedEnabled] = useState<boolean | null>(null);

  const selectedTemplate = buildClinicDeploymentTemplate(deploymentTemplateCode);
  const defaultModules = useMemo(() => {
    if (!selectedTemplate) return [];
    return [...resolveModuleBundle(selectedTemplate.moduleBundleCode).enabledModules];
  }, [selectedTemplate]);

  const [enabledModules, setEnabledModules] = useState<string[]>([...defaultModules]);

  const moduleCodes = listAvailableModuleCodesForProvisioning();

  const previewReadiness = useMemo(() => {
    if (!selectedTemplate) return null;
    return calculateTemplateReadiness(selectedTemplate, {
      tenantName: tenantName || "Preview",
      tenantSlug: tenantSlug || "preview",
      defaultClinicDisplayName: clinicName || "Preview Clinic",
      defaultTimezone: timezone,
      firstTenantAdminEmail: adminEmail || "admin@preview.test",
      deploymentTemplateCode,
      enabledModuleCodes: modulesTouched ? enabledModules : null,
      sandboxSeedEnabled,
    });
  }, [
    selectedTemplate,
    tenantName,
    tenantSlug,
    clinicName,
    timezone,
    adminEmail,
    deploymentTemplateCode,
    modulesTouched,
    enabledModules,
    sandboxSeedEnabled,
  ]);

  function onTenantNameChange(value: string) {
    setTenantName(value);
    if (!slugTouched) {
      setTenantSlug(buildTenantSlug(value));
    }
    if (!clinicName) {
      setClinicName(value);
    }
  }

  function onTemplateChange(code: ClinicDeploymentTemplateCode) {
    setDeploymentTemplateCode(code);
    const template = buildClinicDeploymentTemplate(code);
    if (template && !modulesTouched) {
      setEnabledModules([...resolveModuleBundle(template.moduleBundleCode).enabledModules]);
    }
    setSandboxSeedEnabled(null);
  }

  function toggleModule(code: string) {
    setModulesTouched(true);
    setEnabledModules((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
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
        deploymentTemplateCode,
        enabledModuleCodes: modulesTouched ? enabledModules : null,
        sandboxSeedEnabled,
      });
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      router.push(`/fi-admin/platform/onboarding/${res.sessionId}`);
      router.refresh();
    });
  }

  const rolePack = selectedTemplate ? resolveRolePack(selectedTemplate.rolePackCode) : null;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-200">New provisioning session</h2>
      <p className="mt-1 text-xs text-slate-500">
        Phase B — choose a clinic deployment template. Service catalog deploys automatically; CRM
        workflows and sandbox seeds remain template-only until connectors ship.
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
          <span className="text-xs font-medium text-slate-400">Deployment template</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
            value={deploymentTemplateCode}
            onChange={(ev) => onTemplateChange(ev.target.value as ClinicDeploymentTemplateCode)}
          >
            {TEMPLATE_OPTIONS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.displayName}
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <p className="mt-1 text-xs text-slate-500">{selectedTemplate.description}</p>
          ) : null}
        </label>

        {selectedTemplate ? (
          <div className="sm:col-span-2 rounded-lg border border-white/[0.08] bg-[#030810]/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Template includes
            </p>
            <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-400">Modules</dt>
                <dd className="mt-1 text-slate-300">
                  {(modulesTouched ? enabledModules : defaultModules)
                    .map(
                      (c) => FI_MODULE_DISPLAY_NAMES[c as keyof typeof FI_MODULE_DISPLAY_NAMES] ?? c
                    )
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Roles</dt>
                <dd className="mt-1 text-slate-300">
                  {rolePack
                    ? [rolePack.primaryAdminRole, ...rolePack.additionalRoles].join(", ")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Services</dt>
                <dd className="mt-1 text-slate-300">
                  {selectedTemplate.serviceTemplates.map((s) => s.name).join(", ")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Workflows</dt>
                <dd className="mt-1 text-slate-300">
                  {selectedTemplate.workflowTemplates.map((w) => w.name).join(", ")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Academy tracks</dt>
                <dd className="mt-1 text-slate-300">
                  {selectedTemplate.academyAssignments.length
                    ? selectedTemplate.academyAssignments.map((a) => a.trackName).join(", ")
                    : "None"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Sandbox seed</dt>
                <dd className="mt-1 text-slate-300">
                  {(sandboxSeedEnabled ?? selectedTemplate.sandboxSeed.enabled)
                    ? "Enabled"
                    : "Disabled"}
                </dd>
              </div>
            </dl>
            {previewReadiness ? (
              <p className="mt-3 text-xs text-slate-400">
                Readiness:{" "}
                <span className={previewReadiness.ready ? "text-emerald-400" : "text-amber-400"}>
                  {previewReadiness.score}% {previewReadiness.ready ? "ready" : "needs review"}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={sandboxSeedEnabled ?? selectedTemplate?.sandboxSeed.enabled ?? false}
            onChange={(ev) => setSandboxSeedEnabled(ev.target.checked)}
            className="rounded border-white/20"
          />
          <span className="text-sm text-slate-300">Enable sandbox demo seed plan</span>
        </label>

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
          <legend className="text-xs font-medium text-slate-400">
            Module overrides (optional)
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {moduleCodes.map((code) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#030810]/60 px-3 py-2 text-sm text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={(modulesTouched ? enabledModules : defaultModules).includes(code)}
                  onChange={() => toggleModule(code)}
                  className="rounded border-white/20"
                />
                <span>
                  {FI_MODULE_DISPLAY_NAMES[code as keyof typeof FI_MODULE_DISPLAY_NAMES] ?? code}
                </span>
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
