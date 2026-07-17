"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import {
  HUBSPOT_CANONICAL_SURFACES,
  hubspotSurfaceHref,
} from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";

function CopyBlock({ label, text, hint }: { label: string; text: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#060d18]/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md border border-white/[0.12] bg-[#141C33] px-2.5 py-1 text-xs font-medium text-[#22C1FF] transition hover:bg-white/[0.06]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-[#94A3B8]">{text}</p>
      {hint ? <p className="mt-2 text-xs text-[#64748B]">{hint}</p> : null}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
          : "inline-flex rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300"
      }
    >
      {label}
    </span>
  );
}

export function OtherIntegrationsSection({
  tenantId,
  appOrigin,
  hubSpotConnected,
  hubSpotWebhookSecretConfigured,
  stripeCheckoutEnabled,
  stripeWebhookSecretConfigured,
}: {
  tenantId: string;
  appOrigin: string;
  hubSpotConnected: boolean;
  hubSpotWebhookSecretConfigured: boolean;
  stripeCheckoutEnabled: boolean;
  stripeWebhookSecretConfigured: boolean;
}) {
  const base = `/fi-admin/${tenantId}`;
  const origin = appOrigin.replace(/\/+$/, "");
  const hubSpotLeadFlowWebhook = `${origin}/api/tenants/${tenantId}/integrations/hubspot/webhook`;
  const stripeWebhook = `${origin}/api/fi-payments/stripe/webhook`;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/40 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-[#F8FAFC]">Other integrations</h2>
      <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
        Timely, HubSpot, and Stripe setup paths. Secrets stay on the server — copy webhook URLs
        below for external system configuration.
      </p>

      <div className="mt-5 space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F8FAFC]">Timely</h3>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li>
              <Link
                href={`${base}/settings/integrations/timely`}
                className="text-[#22C1FF] hover:underline"
              >
                Timely · Zapier setup
              </Link>
              — webhook URLs and manual Timely wiring.
            </li>
            <li>
              <Link
                href={`${base}/settings/integrations/timely/discovery`}
                className="text-[#22C1FF] hover:underline"
              >
                Timely · Zapier discovery
              </Link>
              — raw payload capture for mapping work.
            </li>
          </ul>
        </div>

        <div className="space-y-3 border-t border-white/[0.06] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">HubSpot</h3>
            <StatusPill
              ok={hubSpotConnected}
              label={hubSpotConnected ? "Connector registered" : "Not connected"}
            />
          </div>
          {false ? (
            <>
              <ul className="space-y-2 text-sm text-[#94A3B8]">
                <li>
                  <Link href={`${base}/configuration`} className="text-[#22C1FF] hover:underline">
                    Configuration → Connect Existing Systems
                  </Link>
                  — register HubSpot, store Private App token, run read-only sync into staging.
                </li>
                <li>
                  <Link
                    href={`${base}/settings/imports/hubspot`}
                    className="text-[#22C1FF] hover:underline"
                  >
                    HubSpot CRM import
                  </Link>
                  — one-time contacts CSV upload (Stage 1).
                </li>
                <li>
                  <Link
                    href={`${base}/onboarding-os/import-review`}
                    className="text-[#22C1FF] hover:underline"
                  >
                    OnboardingOS import review
                  </Link>
                  — approve staged HubSpot contacts and deals after connector sync.
                </li>
              </ul>
              <CopyBlock
                label="LeadFlow webhook (live CRM events)"
                text={`POST ${hubSpotLeadFlowWebhook}`}
                hint={
                  hubSpotWebhookSecretConfigured
                    ? "HubSpot native app webhooks use signature v3 (HUBSPOT_CLIENT_SECRET). Internal/Zapier POSTs may use Authorization: Bearer FI_HUBSPOT_WEBHOOK_SECRET."
                    : "Set FI_HUBSPOT_WEBHOOK_SECRET (Bearer) and/or HUBSPOT_CLIENT_SECRET (signature v3) on the server before go-live."
                }
              />
            </>
          ) : null}
          <p className="text-sm text-[#94A3B8]">
            Credentials, backups, staged imports, webhooks, configuration, and audit evidence are
            managed in one tenant-scoped workspace.
          </p>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            {HUBSPOT_CANONICAL_SURFACES.map((surface) => (
              <li key={surface.id}>
                <Link
                  href={hubspotSurfaceHref(tenantId, surface)}
                  className="text-[#22C1FF] hover:underline"
                >
                  {surface.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`${base}/settings/integrations/hubspot`}
            className="inline-flex rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Manage
          </Link>
        </div>

        <div className="space-y-3 border-t border-white/[0.06] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">Stripe</h3>
            <StatusPill
              ok={stripeCheckoutEnabled}
              label={stripeCheckoutEnabled ? "Checkout enabled" : "Manual / not configured"}
            />
          </div>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li>
              <Link href={`${base}/settings/payments`} className="text-[#22C1FF] hover:underline">
                Settings → Payments
              </Link>
              — collection mode, link expiry, and runtime flags (read-only). Payment requests are
              created from consultations, surgery, and the payments inbox.
            </li>
          </ul>
          <CopyBlock
            label="Stripe webhook endpoint"
            text={`POST ${stripeWebhook}`}
            hint={
              stripeWebhookSecretConfigured
                ? "Configure this URL in the Stripe Dashboard. STRIPE_WEBHOOK_SECRET verifies signatures on the server."
                : "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the deployment, then register this endpoint in Stripe."
            }
          />
        </div>
      </div>
    </section>
  );
}
