"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  upsertClinicSettingsAction,
  upsertOrganisationSettingsAction,
  upsertTenantSettingsAction,
} from "@/lib/actions/fi-configuration-actions";
import type { EffectiveBranding, TenantConfigurationOverview } from "@/src/lib/fi/foundation/tenantSettings";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-base font-medium text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function KeyVal({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-2 last:border-0 sm:grid-cols-3">
      <dt className="text-xs text-gray-500">{k}</dt>
      <dd className="sm:col-span-2 text-sm text-gray-900 break-all">{v?.trim() ? v : "—"}</dd>
    </div>
  );
}

function ColourSwatch({ label, hex }: { label: string; hex: string | null }) {
  if (!hex?.trim()) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-6 w-6 rounded border border-dashed border-gray-300 bg-gray-50" />
        {label}: —
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="h-6 w-6 shrink-0 rounded border border-gray-300"
        style={{ backgroundColor: hex }}
        title={hex}
      />
      <span className="text-gray-700">
        {label}: <code className="rounded bg-gray-100 px-1">{hex}</code>
      </span>
    </div>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoComplete="street-address"
      />
      {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoComplete="off"
      />
      {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

function Feedback({ message, ok }: { message: string | null; ok: boolean | null }) {
  if (!message) return null;
  const cls = ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-800 bg-red-50 border-red-200";
  return (
    <p role="status" className={`rounded border px-2 py-1.5 text-xs ${cls}`}>
      {message}
    </p>
  );
}

export function TenantConfigurationPanel({
  tenantId,
  overview,
  effective,
  previewOrganisationId,
  previewClinicId,
}: {
  tenantId: string;
  overview: TenantConfigurationOverview;
  effective: EffectiveBranding;
  previewOrganisationId: string | null;
  previewClinicId: string | null;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/configuration`;
  const q = new URLSearchParams();
  if (previewOrganisationId) q.set("organisationId", previewOrganisationId);
  if (previewClinicId) q.set("clinicId", previewClinicId);
  const previewQs = q.toString();

  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tenantFb, setTenantFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [orgFb, setOrgFb] = useState<Record<string, { ok: boolean; text: string } | null>>({});
  const [clinicFb, setClinicFb] = useState<Record<string, { ok: boolean; text: string } | null>>({});

  const tenantKey = overview.tenant_settings?.updated_at ?? "no-row";

  return (
    <div className="space-y-8 text-sm">
      <p className="max-w-3xl text-xs text-gray-600">
        Branding and operational URLs for this tenant. Values cascade from tenant to organisation to clinic; use preview
        links to evaluate effective branding. Edits require the server{" "}
        <code className="rounded bg-gray-100 px-1">FI_ADMIN_API_KEY</code> (paste below per save). All writes run on the
        server with the Supabase service role — nothing is written from the browser.
      </p>

      <Section title="FI admin authentication">
        <label className="block max-w-md space-y-1">
          <span className="text-xs font-medium text-gray-700">Admin key (not stored)</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="FI_ADMIN_API_KEY"
            autoComplete="off"
          />
          <span className="block text-xs text-gray-500">Required for each save below. Never commit this value.</span>
        </label>
      </Section>

      <Section title="Tenant branding">
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Current</h3>
            {overview.tenant_settings ? (
              <dl>
                <KeyVal k="Brand name" v={overview.tenant_settings.brand_name} />
                <KeyVal k="Logo URL" v={overview.tenant_settings.logo_url} />
                <div className="flex flex-wrap gap-4 py-2">
                  <ColourSwatch label="Primary" hex={overview.tenant_settings.primary_colour} />
                  <ColourSwatch label="Secondary" hex={overview.tenant_settings.secondary_colour} />
                  <ColourSwatch label="Accent" hex={overview.tenant_settings.accent_colour} />
                </div>
                <KeyVal k="Support email" v={overview.tenant_settings.support_email} />
                <KeyVal k="Default timezone" v={overview.tenant_settings.default_timezone} />
              </dl>
            ) : (
              <p className="text-xs text-gray-500">No tenant settings row yet — saving the form will create one.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Edit</h3>
            <form
              key={tenantKey}
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setTenantFb(null);
                setBusy("tenant");
                const fd = new FormData(e.currentTarget);
                const res = await upsertTenantSettingsAction({
                  adminKey,
                  tenantId,
                  brand_name: String(fd.get("brand_name") ?? ""),
                  logo_url: String(fd.get("logo_url") ?? ""),
                  primary_colour: String(fd.get("primary_colour") ?? ""),
                  secondary_colour: String(fd.get("secondary_colour") ?? ""),
                  accent_colour: String(fd.get("accent_colour") ?? ""),
                  support_email: String(fd.get("support_email") ?? ""),
                  default_timezone: String(fd.get("default_timezone") ?? ""),
                });
                setBusy(null);
                if (res.ok) {
                  setTenantFb({ ok: true, text: "Tenant settings saved." });
                  router.refresh();
                } else {
                  setTenantFb({ ok: false, text: res.error });
                }
              }}
            >
              <Field label="Brand / display name" name="brand_name" defaultValue={overview.tenant_settings?.brand_name} />
              <Field label="Logo URL" name="logo_url" defaultValue={overview.tenant_settings?.logo_url} hint="http(s) only" />
              <Field label="Primary colour" name="primary_colour" defaultValue={overview.tenant_settings?.primary_colour} hint="#rgb or #rrggbb" />
              <Field label="Secondary colour" name="secondary_colour" defaultValue={overview.tenant_settings?.secondary_colour} />
              <Field label="Accent colour" name="accent_colour" defaultValue={overview.tenant_settings?.accent_colour} />
              <Field label="Support email" name="support_email" defaultValue={overview.tenant_settings?.support_email} />
              <Field label="Default timezone" name="default_timezone" defaultValue={overview.tenant_settings?.default_timezone} hint="e.g. Europe/London" />
              <button
                type="submit"
                disabled={busy !== null}
                className="mt-2 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {busy === "tenant" ? "Saving…" : "Save tenant settings"}
              </button>
              <div className="pt-2">
                <Feedback message={tenantFb?.text ?? null} ok={tenantFb === null ? null : tenantFb.ok} />
              </div>
            </form>
          </div>
        </div>
      </Section>

      <Section title="Organisation settings">
        {overview.organisations.length === 0 ? (
          <p className="text-sm text-gray-500">No organisations for this tenant.</p>
        ) : (
          <ul className="space-y-6">
            {overview.organisations.map(({ organisation, settings }) => {
              const fk = settings?.updated_at ?? `none-${organisation.id}`;
              const fb = orgFb[organisation.id];
              return (
                <li key={organisation.id} className="rounded border border-gray-100 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{organisation.name}</span>
                    <Link href={`${base}?organisationId=${organisation.id}`} className="text-xs text-blue-700 hover:underline">
                      Preview cascade (org)
                    </Link>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Current</h4>
                      {settings ? (
                        <dl className="text-xs">
                          <KeyVal k="Brand name" v={settings.brand_name} />
                          <KeyVal k="Logo URL" v={settings.logo_url} />
                          <div className="flex flex-wrap gap-3 py-2">
                            <ColourSwatch label="Primary" hex={settings.primary_colour} />
                            <ColourSwatch label="Secondary" hex={settings.secondary_colour} />
                            <ColourSwatch label="Accent" hex={settings.accent_colour} />
                          </div>
                          <KeyVal k="Website" v={settings.website_url} />
                          <KeyVal k="Support email" v={settings.support_email} />
                        </dl>
                      ) : (
                        <p className="text-xs text-gray-500">No organisation settings row — saving creates one.</p>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Edit</h4>
                      <form
                        key={fk}
                        className="space-y-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setOrgFb((m) => ({ ...m, [organisation.id]: null }));
                          setBusy(`org:${organisation.id}`);
                          const fd = new FormData(e.currentTarget);
                          const res = await upsertOrganisationSettingsAction({
                            adminKey,
                            tenantId,
                            organisationId: organisation.id,
                            brand_name: String(fd.get("brand_name") ?? ""),
                            logo_url: String(fd.get("logo_url") ?? ""),
                            primary_colour: String(fd.get("primary_colour") ?? ""),
                            secondary_colour: String(fd.get("secondary_colour") ?? ""),
                            accent_colour: String(fd.get("accent_colour") ?? ""),
                            website_url: String(fd.get("website_url") ?? ""),
                            support_email: String(fd.get("support_email") ?? ""),
                          });
                          setBusy(null);
                          if (res.ok) {
                            setOrgFb((m) => ({ ...m, [organisation.id]: { ok: true, text: "Organisation settings saved." } }));
                            router.refresh();
                          } else {
                            setOrgFb((m) => ({ ...m, [organisation.id]: { ok: false, text: res.error } }));
                          }
                        }}
                      >
                        <Field label="Brand name" name="brand_name" defaultValue={settings?.brand_name} />
                        <Field label="Logo URL" name="logo_url" defaultValue={settings?.logo_url} />
                        <Field label="Primary colour" name="primary_colour" defaultValue={settings?.primary_colour} />
                        <Field label="Secondary colour" name="secondary_colour" defaultValue={settings?.secondary_colour} />
                        <Field label="Accent colour" name="accent_colour" defaultValue={settings?.accent_colour} />
                        <Field label="Website URL" name="website_url" defaultValue={settings?.website_url} />
                        <Field label="Support email" name="support_email" defaultValue={settings?.support_email} />
                        <button
                          type="submit"
                          disabled={busy !== null}
                          className="mt-2 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {busy === `org:${organisation.id}` ? "Saving…" : `Save — ${organisation.name}`}
                        </button>
                        <div className="pt-2">
                          <Feedback message={fb?.text ?? null} ok={fb === null || fb === undefined ? null : fb.ok} />
                        </div>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Clinic settings">
        {overview.clinics.length === 0 ? (
          <p className="text-sm text-gray-500">No clinics for this tenant.</p>
        ) : (
          <ul className="space-y-6">
            {overview.clinics.map(({ clinic, settings }) => {
              const fk = settings?.updated_at ?? `none-${clinic.id}`;
              const fb = clinicFb[clinic.id];
              return (
                <li key={clinic.id} className="rounded border border-gray-100 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{clinic.display_name}</span>
                    <div className="flex gap-2 text-xs">
                      <Link href={`${base}?clinicId=${clinic.id}`} className="text-blue-700 hover:underline">
                        Preview (clinic)
                      </Link>
                      {clinic.organisation_id ? (
                        <Link
                          href={`${base}?organisationId=${clinic.organisation_id}&clinicId=${clinic.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          Preview (org + clinic)
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Current</h4>
                      {settings ? (
                        <dl className="text-xs">
                          <KeyVal k="Display name" v={settings.display_name} />
                          <KeyVal k="Booking URL" v={settings.booking_url} />
                          <KeyVal k="Public intake URL" v={settings.public_intake_url} />
                          <KeyVal k="Phone" v={settings.phone} />
                          <KeyVal k="Email" v={settings.email} />
                          <KeyVal k="Address" v={settings.address} />
                          <KeyVal k="Timezone" v={settings.timezone} />
                        </dl>
                      ) : (
                        <p className="text-xs text-gray-500">No clinic settings row — saving creates one.</p>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Edit</h4>
                      <form
                        key={fk}
                        className="space-y-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setClinicFb((m) => ({ ...m, [clinic.id]: null }));
                          setBusy(`clinic:${clinic.id}`);
                          const fd = new FormData(e.currentTarget);
                          const res = await upsertClinicSettingsAction({
                            adminKey,
                            tenantId,
                            clinicId: clinic.id,
                            display_name: String(fd.get("display_name") ?? ""),
                            booking_url: String(fd.get("booking_url") ?? ""),
                            public_intake_url: String(fd.get("public_intake_url") ?? ""),
                            phone: String(fd.get("phone") ?? ""),
                            email: String(fd.get("email") ?? ""),
                            address: String(fd.get("address") ?? ""),
                            timezone: String(fd.get("timezone") ?? ""),
                          });
                          setBusy(null);
                          if (res.ok) {
                            setClinicFb((m) => ({
                              ...m,
                              [clinic.id]: { ok: true, text: "Clinic settings saved." },
                            }));
                            router.refresh();
                          } else {
                            setClinicFb((m) => ({ ...m, [clinic.id]: { ok: false, text: res.error } }));
                          }
                        }}
                      >
                        <Field label="Display name" name="display_name" defaultValue={settings?.display_name} />
                        <Field label="Booking URL" name="booking_url" defaultValue={settings?.booking_url} />
                        <Field label="Public intake URL" name="public_intake_url" defaultValue={settings?.public_intake_url} />
                        <Field label="Phone" name="phone" defaultValue={settings?.phone} />
                        <Field label="Email" name="email" defaultValue={settings?.email} />
                        <TextAreaField label="Address" name="address" defaultValue={settings?.address} />
                        <Field label="Timezone" name="timezone" defaultValue={settings?.timezone} />
                        <button
                          type="submit"
                          disabled={busy !== null}
                          className="mt-2 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {busy === `clinic:${clinic.id}` ? "Saving…" : `Save — ${clinic.display_name}`}
                        </button>
                        <div className="pt-2">
                          <Feedback message={fb?.text ?? null} ok={fb === null || fb === undefined ? null : fb.ok} />
                        </div>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Effective branding preview">
        <p className="mb-3 text-xs text-gray-600">
          Cascade: clinic display name (if set) overrides brand name; colours flow organisation → tenant; contact and
          timezone prefer clinic where set. Current preview:{" "}
          <span className="font-mono">
            {previewOrganisationId ? `organisation=${previewOrganisationId.slice(0, 8)}…` : "no organisation"}
            {previewClinicId ? ` · clinic=${previewClinicId.slice(0, 8)}…` : ""}
          </span>
          {previewQs ? (
            <>
              {" "}
              <Link href={base} className="text-blue-700 hover:underline">
                Clear preview
              </Link>
            </>
          ) : null}
        </p>
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-lg font-semibold text-gray-900">{effective.brand_name ?? "Untitled brand"}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <ColourSwatch label="Primary" hex={effective.primary_colour} />
            <ColourSwatch label="Secondary" hex={effective.secondary_colour} />
            <ColourSwatch label="Accent" hex={effective.accent_colour} />
          </div>
          <dl className="mt-4 space-y-1 text-xs">
            <KeyVal k="Logo URL" v={effective.logo_url} />
            <KeyVal k="Support email" v={effective.support_email} />
            <KeyVal k="Default / clinic timezone" v={effective.default_timezone ?? effective.clinic_timezone} />
            <KeyVal k="Website" v={effective.website_url} />
            <KeyVal k="Booking URL" v={effective.booking_url} />
            <KeyVal k="Public intake URL" v={effective.public_intake_url} />
            <KeyVal k="Clinic phone" v={effective.clinic_phone} />
            <KeyVal k="Clinic email" v={effective.clinic_email} />
            <KeyVal k="Address" v={effective.address} />
          </dl>
        </div>
      </Section>
    </div>
  );
}
