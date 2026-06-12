import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  readFiPaymentCancelUrl,
  readFiPaymentProviderId,
  readFiPaymentRequestDefaultExpiryDays,
  readFiPaymentSuccessUrl,
  readFiPaymentsEnabled,
  readStripeWebhookSecret,
} from "@/src/lib/payments/fiPaymentEnv.server";

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiOsPaymentsSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);

  const enabled = readFiPaymentsEnabled();
  const provider = readFiPaymentProviderId();
  const successUrl = readFiPaymentSuccessUrl();
  const cancelUrl = readFiPaymentCancelUrl();
  const webhookConfigured = Boolean(readStripeWebhookSecret());
  const defaultExpiryDays = readFiPaymentRequestDefaultExpiryDays();
  const stripeMode = enabled && provider === "stripe";

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8 text-slate-100">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">Settings</p>
        <h1 className="text-xl font-semibold text-white">Payments &amp; RevenueOS</h1>
        <p className="text-sm text-slate-400">
          Gateway configuration is server-only. Invoices and payment requests are created from ConsultationOS, SurgeryOS, the{" "}
          <Link href={`/fi-admin/${tid}/payments`} className="text-cyan-300 underline hover:text-cyan-200">
            payments inbox
          </Link>
          , and finance actions — amounts remain staff-verified.
        </p>
      </header>

      <section className="rounded-xl border border-white/[0.08] bg-[#0b1220]/80 p-5">
        <h2 className="text-sm font-semibold text-white">Collection mode</h2>
        <dl className="mt-3 space-y-2 text-sm text-slate-300">
          <div className="flex justify-between gap-4">
            <dt>FI_PAYMENTS_ENABLED</dt>
            <dd className="font-mono text-cyan-200">{enabled ? "true" : "false"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>FI_PAYMENT_PROVIDER</dt>
            <dd className="font-mono text-cyan-200">{provider}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Effective mode</dt>
            <dd className="font-mono text-cyan-200">{stripeMode ? "Stripe checkout" : "Manual / link-only"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Stripe webhook secret</dt>
            <dd className="font-mono text-cyan-200">{webhookConfigured ? "configured" : "missing"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0b1220]/80 p-5">
        <h2 className="text-sm font-semibold text-white">Payment links</h2>
        <p className="mt-2 text-sm text-slate-400">
          Public patient pages use opaque tokens at <code className="rounded bg-black/40 px-1">/pay/[token]</code> — no tenant dashboard
          sign-in required.
        </p>
        <dl className="mt-3 space-y-2 text-sm text-slate-300">
          <div className="flex justify-between gap-4">
            <dt>Default link expiry hint (days)</dt>
            <dd className="font-mono text-cyan-200">
              {defaultExpiryDays} <span className="text-xs text-slate-500">(FI_PAYMENT_REQUEST_EXPIRY_DAYS)</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0b1220]/80 p-5">
        <h2 className="text-sm font-semibold text-white">Automation (placeholders)</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
          <li>Deposit reminder templates — not wired to outbound email/SMS yet.</li>
          <li>Balance reminder templates — not wired to outbound email/SMS yet.</li>
          <li>Automation master toggle — placeholder until consent + templates exist.</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          A cron entry point exists at <code className="rounded bg-black/40 px-1">POST /api/cron/fi-payments/reminders</code> (Bearer secret). It
          currently records CRM/metadata only for due/overdue signals and is idempotent per invoice/day. Auto-send to patients requires a later
          cron stage, explicit tenant settings, and a safe sender configuration — not enabled here.
        </p>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0b1220]/80 p-5">
        <h2 className="text-sm font-semibold text-white">Runtime flags (process env)</h2>
        <dl className="mt-3 space-y-2 text-sm text-slate-300">
          <div className="flex justify-between gap-4">
            <dt>FI_PAYMENT_SUCCESS_URL</dt>
            <dd className="max-w-[60%] truncate font-mono text-xs text-slate-400">{successUrl ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>FI_PAYMENT_CANCEL_URL</dt>
            <dd className="max-w-[60%] truncate font-mono text-xs text-slate-400">{cancelUrl ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Stripe secrets are never shown here. Webhook endpoint:{" "}
          <code className="rounded bg-black/40 px-1">POST /api/fi-payments/stripe/webhook</code>
        </p>
      </section>
    </div>
  );
}
