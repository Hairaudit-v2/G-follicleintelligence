"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { FiOsEmptyState } from "@/src/components/fi-admin/shared/FiOsEmptyState";
import {
  PATHOLOGY_EMAIL_WEBHOOK_SECRET_HEADER,
  type PathologyEmailRouteStatusValue,
} from "@/src/lib/pathology/email/pathologyEmailRoutesCore";
import type { PathologyEmailRouteListItem } from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const PANEL_CLASS = "rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5";

function statusBadge(status: PathologyEmailRouteStatusValue): string {
  return status === "active"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function PathologyEmailRoutesClient(props: {
  tenantId: string;
  initialRoutes: PathologyEmailRouteListItem[];
  webhookUrl: string;
  canMutate: boolean;
  emailIngestionEnabled: boolean;
}) {
  const { tenantId, initialRoutes, webhookUrl, canMutate, emailIngestionEnabled } = props;
  const router = useRouter();
  const [routes, setRoutes] = useState(initialRoutes);
  const [inboundEmail, setInboundEmail] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; message: string } | null>(null);
  const [pending, start] = useTransition();

  const activeCount = useMemo(
    () => routes.filter((route) => route.route_status === "active").length,
    [routes]
  );

  function showFeedback(tone: "ok" | "err", message: string) {
    setFeedback({ tone, message });
  }

  async function handleCopy(label: string, value: string) {
    const ok = await copyText(value);
    showFeedback(ok ? "ok" : "err", ok ? `${label} copied.` : `Could not copy ${label.toLowerCase()}.`);
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!canMutate) return;

    start(async () => {
      setFeedback(null);
      try {
        const res = await fetch(`/api/tenants/${tenantId}/pathology-email-routes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inbound_email: inboundEmail,
            source_label: sourceLabel.trim() || null,
            route_status: "active",
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          route?: PathologyEmailRouteListItem;
        };
        if (!res.ok || !json.ok || !json.route) {
          showFeedback("err", json.error ?? "Could not create route.");
          return;
        }

        setRoutes((prev) => [
          {
            ...json.route!,
            message_count: 0,
            last_used_at: null,
            last_provider: null,
          },
          ...prev.filter((route) => route.id !== json.route!.id),
        ]);
        setInboundEmail("");
        setSourceLabel("");
        showFeedback("ok", "Inbound address added.");
        router.refresh();
      } catch {
        showFeedback("err", "Could not create route.");
      }
    });
  }

  function handleStatusChange(routeId: string, routeStatus: PathologyEmailRouteStatusValue) {
    if (!canMutate) return;

    start(async () => {
      setFeedback(null);
      try {
        const res = await fetch(`/api/tenants/${tenantId}/pathology-email-routes/${routeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route_status: routeStatus }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          route?: PathologyEmailRouteListItem;
        };
        if (!res.ok || !json.ok || !json.route) {
          showFeedback("err", json.error ?? "Could not update route.");
          return;
        }

        setRoutes((prev) =>
          prev.map((route) =>
            route.id === routeId
              ? {
                  ...route,
                  ...json.route!,
                  message_count: route.message_count,
                  last_used_at: route.last_used_at,
                  last_provider: route.last_provider,
                }
              : route
          )
        );
        showFeedback(
          "ok",
          routeStatus === "disabled" ? "Inbound address disabled." : "Inbound address reactivated."
        );
        router.refresh();
      } catch {
        showFeedback("err", "Could not update route.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className={PANEL_CLASS}>
        <h2 className="text-base font-semibold text-[#F8FAFC]">Webhook configuration</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          Point your inbound email provider (Postmark recommended) at this endpoint. Include the
          shared secret header on every webhook request.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[#64748B]">Webhook endpoint</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-[#060d18] px-2 py-1 text-xs text-[#CBD5E1]">
                POST {webhookUrl}
              </code>
              <button
                type="button"
                className="rounded border border-white/10 px-2 py-1 text-xs text-[#22C1FF] hover:bg-white/5"
                onClick={() => void handleCopy("Webhook URL", webhookUrl)}
              >
                Copy URL
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Required secret header</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-[#060d18] px-2 py-1 text-xs text-[#CBD5E1]">
                {PATHOLOGY_EMAIL_WEBHOOK_SECRET_HEADER}
              </code>
              <button
                type="button"
                className="rounded border border-white/10 px-2 py-1 text-xs text-[#22C1FF] hover:bg-white/5"
                onClick={() => void handleCopy("Header name", PATHOLOGY_EMAIL_WEBHOOK_SECRET_HEADER)}
              >
                Copy header
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Ingestion flag</dt>
            <dd className="mt-1 text-[#E2E8F0]">
              {emailIngestionEnabled ? (
                <span className="text-emerald-200">PATHOLOGY_EMAIL_INGESTION_ENABLED=true</span>
              ) : (
                <span className="text-amber-200">
                  PATHOLOGY_EMAIL_INGESTION_ENABLED is off — webhooks return 503 until enabled.
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {canMutate ? (
        <section className={PANEL_CLASS}>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Add inbound address</h2>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Register a dedicated inbound address (for example{" "}
            <code className="text-[#CBD5E1]">pathology+evolved@inbound.yourdomain.com</code>)
            mapped to this tenant.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleCreate}>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Inbound email
              </span>
              <input
                type="email"
                required
                value={inboundEmail}
                onChange={(event) => setInboundEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#060d18] px-3 py-2 text-sm text-[#F8FAFC]"
                placeholder="pathology+evolved@inbound.yourdomain.com"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Source label (optional)
              </span>
              <input
                type="text"
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#060d18] px-3 py-2 text-sm text-[#F8FAFC]"
                placeholder="Evolved Pathology Inbox"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[#22C1FF] px-4 py-2 text-sm font-medium text-[#04101f] disabled:opacity-60"
              >
                {pending ? "Saving…" : "Add route"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Inbound addresses</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {activeCount} active · {routes.length} total
            </p>
          </div>
          <Link
            href={`/fi-admin/${tenantId}/pathology/inbox`}
            className="text-sm text-[#22C1FF] hover:underline"
          >
            Open results inbox
          </Link>
        </div>

        {feedback ? (
          <p
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              feedback.tone === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}

        {routes.length === 0 ? (
          <div className="mt-4">
            <FiOsEmptyState
              title="No inbound addresses yet"
              description="Add a route above or run the Evolved seed after setting PATHOLOGY_EMAIL_INBOUND_DOMAIN."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-2 py-2">Address</th>
                  <th className="px-2 py-2">Source label</th>
                  <th className="px-2 py-2">Last provider</th>
                  <th className="px-2 py-2">Messages</th>
                  <th className="px-2 py-2">Last used</th>
                  <th className="px-2 py-2">Status</th>
                  {canMutate ? <th className="px-2 py-2">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="text-[#E2E8F0]">
                {routes.map((route) => (
                  <tr key={route.id} className="border-t border-white/[0.06]">
                    <td className="px-2 py-3 font-mono text-xs">{route.inbound_email}</td>
                    <td className="px-2 py-3">{route.source_label ?? "—"}</td>
                    <td className="px-2 py-3">{route.last_provider ?? "—"}</td>
                    <td className="px-2 py-3">{route.message_count}</td>
                    <td className="px-2 py-3">{formatWhen(route.last_used_at)}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(route.route_status)}`}
                      >
                        {route.route_status}
                      </span>
                    </td>
                    {canMutate ? (
                      <td className="px-2 py-3">
                        {route.route_status === "active" ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="text-xs text-amber-200 hover:underline disabled:opacity-60"
                            onClick={() => handleStatusChange(route.id, "disabled")}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            className="text-xs text-emerald-200 hover:underline disabled:opacity-60"
                            onClick={() => handleStatusChange(route.id, "active")}
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
