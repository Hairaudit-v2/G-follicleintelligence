"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  upsertClinicSettingsAction,
  upsertOrganisationSettingsAction,
  upsertTenantSettingsAction,
} from "@/lib/actions/fi-configuration-actions";
import { FiTenantOperatingModePanel } from "@/src/components/fi-os/FiTenantOperatingModePanel";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { EffectiveBranding, TenantConfigurationOverview } from "@/src/lib/fi/foundation/tenantSettings";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-[#F8FAFC]">{title}</h2>
      {children}
    </section>
  );
}

function KeyVal({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-white/[0.06] py-2 last:border-0 sm:grid-cols-3">
      <dt className="text-xs text-[#94A3B8]">{k}</dt>
      <dd className="break-all text-sm text-[#F8FAFC] sm:col-span-2">{v?.trim() ? v : "—"}</dd>
    </div>
  );
}

function ColourSwatch({ label, hex }: { label: string; hex: string | null }) {
  if (!hex?.trim()) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#64748B]">
        <span className="h-6 w-6 rounded border border-dashed border-white/[0.15] bg-[#081020]/80" />
        {label}: —
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-[#CBD5E1]">
      <span
        className="h-6 w-6 shrink-0 rounded border border-white/[0.12]"
        style={{ backgroundColor: hex }}
        title={hex}
      />
      <span>
        {label}: <code className="rounded bg-[#141C33] px-1 text-[#E2E8F0]">{hex}</code>
      </span>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const saveButtonClass =
  "mt-2 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50";

const sectionLabelClass = "mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]";

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
      <span className="text-xs font-medium text-[#94A3B8]">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className={inputClass}
        autoComplete="street-address"
      />
      {hint ? <span className="block text-xs text-[#64748B]">{hint}</span> : null}
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
      <span className="text-xs font-medium text-[#94A3B8]">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
        autoComplete="off"
      />
      {hint ? <span className="block text-xs text-[#64748B]">{hint}</span> : null}
    </label>
  );
}

function Feedback({ message, ok }: { message: string | null; ok: boolean | null }) {
  if (!message) return null;
  const cls = ok
    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
    : "border-rose-500/30 bg-rose-950/40 text-rose-100";
  return (
    <p role="status" className={`rounded-lg border px-2 py-1.5 text-xs ${cls}`}>
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
  previewFromUrl = false,
}: {
  tenantId: string;
  overview: TenantConfigurationOverview;
  effective: EffectiveBranding;
  previewOrganisationId: string | null;
  previewClinicId: string | null;
  /** True when `organisationId` / `clinicId` came from the page URL (shows "Clear preview"). */
  previewFromUrl?: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/configuration`;

  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tenantFb, setTenantFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [orgFb, setOrgFb] = useState<Record<string, { ok: boolean; text: string } | null>>({});
  const [clinicFb, setClinicFb] = useState<Record<string, { ok: boolean; text: string } | null>>({});

  const tenantKey = overview.tenant_settings?.updated_at ?? "no-row";

  return (
    <div className="space-y-8 text-sm">
      <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
        Branding and operational URLs for this tenant cascade from tenant → organisation → clinic.{" "}
        <strong className="text-[#E2E8F0]">Everyone can review</strong> the sections below.{" "}
        <strong className="text-[#E2E8F0]">Saving changes</strong> uses the deployment{" "}
        <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-xs text-[#22C1FF]">FI_ADMIN_API_KEY</code> in the operator panel — paste the key only when you intend to write. All writes run server-side with the Supabase service role.
      </p>

      <DashboardCard elevated className="border-violet-500/25 bg-[#120a1e]/55 p-4 sm:p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-violet-300/90">Deployment operators</p>
        <h2 className="mt-1 text-base font-semibold text-[#F8FAFC]">Admin API key (optional until you save)</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
          This is <strong className="text-[#E2E8F0]">not</strong> a login for day-to-day staff. It gates configuration writes the same way as secure server tooling — leave blank while browsing; paste only for saves or scripted migrations.
        </p>
        <label className="mt-4 block max-w-md space-y-1.5">
          <span className="text-xs font-medium text-[#94A3B8]">FI_ADMIN_API_KEY</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className={inputClass}
            placeholder="Paste when saving — never committed to git"
            autoComplete="off"
          />
          <span className="block text-xs text-[#64748B]">Required only when you click a Save button. Never share in chat or tickets.</span>
        </label>
      </DashboardCard>

      <FiTenantOperatingModePanel
        tenantId={tenantId}
        currentModeKey={overview.fi_os_operating_mode_key ?? null}
        adminKey={adminKey}
      />

      <Section title="Tenant branding">
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className={sectionLabelClass}>Current</h3>
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
              <p className="text-xs text-[#64748B]">No tenant settings row yet — saving the form will create one.</p>
            )}
          </div>
          <div>
            <h3 className={sectionLabelClass}>Edit</h3>
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
                className={saveButtonClass}
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
          <DashboardCard className="border-dashed border-white/[0.12] p-5 text-sm text-[#94A3B8]">
            <p className="font-medium text-[#E2E8F0]">No organisations for this tenant</p>
            <p className="mt-2 text-xs leading-relaxed sm:text-sm">
              Add an organisation from <span className="text-[#22C1FF]">Directory → Foundation records</span> to unlock organisation-level branding and settings here.
            </p>
          </DashboardCard>
        ) : (
          <ul className="space-y-6">
            {overview.organisations.map(({ organisation, settings }) => {
              const fk = settings?.updated_at ?? `none-${organisation.id}`;
              const fb = orgFb[organisation.id];
              return (
                <li key={organisation.id} className="rounded-xl border border-white/[0.08] bg-[#141C33]/40 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#F8FAFC]">{organisation.name}</span>
                    <Link href={`${base}?organisationId=${organisation.id}`} className="text-xs text-[#22C1FF] hover:underline">
                      Preview cascade (org)
                    </Link>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className={sectionLabelClass}>Current</h4>
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
                        <dl className="text-xs text-[#CBD5E1]">
                          <KeyVal k="Legal / registry name (fi_organisations)" v={organisation.name} />
                          <p className="mt-2 text-xs text-[#64748B]">
                            No organisation settings row yet — saving the form creates{" "}
                            <code className="rounded bg-[#141C33] px-1 text-[#22C1FF]">fi_organisation_settings</code>.
                          </p>
                        </dl>
                      )}
                    </div>
                    <div>
                      <h4 className={sectionLabelClass}>Edit</h4>
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
                        <Field
                          label="Brand name"
                          name="brand_name"
                          defaultValue={settings?.brand_name ?? organisation.name}
                        />
                        <Field label="Logo URL" name="logo_url" defaultValue={settings?.logo_url} />
                        <Field label="Primary colour" name="primary_colour" defaultValue={settings?.primary_colour} />
                        <Field label="Secondary colour" name="secondary_colour" defaultValue={settings?.secondary_colour} />
                        <Field label="Accent colour" name="accent_colour" defaultValue={settings?.accent_colour} />
                        <Field label="Website URL" name="website_url" defaultValue={settings?.website_url} />
                        <Field label="Support email" name="support_email" defaultValue={settings?.support_email} />
                        <button
                          type="submit"
                          disabled={busy !== null}
                          className={saveButtonClass}
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
          <DashboardCard className="border-dashed border-white/[0.12] p-5 text-sm text-[#94A3B8]">
            <p className="font-medium text-[#E2E8F0]">No clinics for this tenant</p>
            <p className="mt-2 text-xs leading-relaxed sm:text-sm">
              Create a clinic from <span className="text-[#22C1FF]">Directory → Foundation records</span> after you have at least one organisation (recommended).
            </p>
          </DashboardCard>
        ) : (
          <ul className="space-y-6">
            {overview.clinics.map(({ clinic, settings }) => {
              const fk = settings?.updated_at ?? `none-${clinic.id}`;
              const fb = clinicFb[clinic.id];
              return (
                <li key={clinic.id} className="rounded-xl border border-white/[0.08] bg-[#141C33]/40 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#F8FAFC]">{clinic.display_name}</span>
                    <div className="flex gap-2 text-xs">
                      <Link href={`${base}?clinicId=${clinic.id}`} className="text-[#22C1FF] hover:underline">
                        Preview (clinic)
                      </Link>
                      {clinic.organisation_id ? (
                        <Link
                          href={`${base}?organisationId=${clinic.organisation_id}&clinicId=${clinic.id}`}
                          className="text-[#22C1FF] hover:underline"
                        >
                          Preview (org + clinic)
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className={sectionLabelClass}>Current</h4>
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
                        <dl className="text-xs text-[#CBD5E1]">
                          <KeyVal k="Display name (fi_clinics)" v={clinic.display_name} />
                          <p className="mt-2 text-xs text-[#64748B]">
                            No clinic settings row yet — saving the form creates{" "}
                            <code className="rounded bg-[#141C33] px-1 text-[#22C1FF]">fi_clinic_settings</code> for this clinic.
                          </p>
                        </dl>
                      )}
                    </div>
                    <div>
                      <h4 className={sectionLabelClass}>Edit</h4>
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
                        <Field
                          label="Display name"
                          name="display_name"
                          defaultValue={settings?.display_name ?? clinic.display_name}
                        />
                        <Field label="Booking URL" name="booking_url" defaultValue={settings?.booking_url} />
                        <Field label="Public intake URL" name="public_intake_url" defaultValue={settings?.public_intake_url} />
                        <Field label="Phone" name="phone" defaultValue={settings?.phone} />
                        <Field label="Email" name="email" defaultValue={settings?.email} />
                        <TextAreaField label="Address" name="address" defaultValue={settings?.address} />
                        <Field label="Timezone" name="timezone" defaultValue={settings?.timezone} />
                        <button
                          type="submit"
                          disabled={busy !== null}
                          className={saveButtonClass}
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
        <p className="mb-3 text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
          Cascade: clinic display name (if set) overrides brand name; colours flow organisation → tenant; contact and
          timezone prefer clinic where set. Current preview:{" "}
          <span className="font-mono text-[#CBD5E1]">
            {previewOrganisationId ? `organisation=${previewOrganisationId.slice(0, 8)}…` : "no organisation"}
            {previewClinicId ? ` · clinic=${previewClinicId.slice(0, 8)}…` : ""}
          </span>
          {previewFromUrl ? (
            <>
              {" "}
              <Link href={base} className="text-[#22C1FF] hover:underline">
                Clear preview
              </Link>
            </>
          ) : null}
        </p>
        <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#081020]/60 p-4">
          <p className="text-lg font-semibold text-[#F8FAFC]">{effective.brand_name ?? "Untitled brand"}</p>
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
