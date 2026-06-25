"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";

import type { GoogleCalendarConnectionStatus } from "@/src/lib/googleCalendar/googleCalendarConnectionStatus.server";

function formatTokenExpiry(tokenExpiresAt: string | null): string {
  if (!tokenExpiresAt) return "Unknown";
  const ms = Date.parse(tokenExpiresAt);
  if (Number.isNaN(ms)) return "Unknown";
  if (ms <= Date.now()) return "Expired";
  const mins = Math.round((ms - Date.now()) / 60_000);
  if (mins < 60) return `Expires in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Expires in ${hours} h`;
  return new Date(ms).toLocaleString();
}

function displayConnectionLabel(status: GoogleCalendarConnectionStatus): string {
  if (!status.connected) return "Not connected";
  if (status.status === "error" || status.status === "expired") return "Needs attention";
  if (status.status === "active") return "Connected";
  return "Needs attention";
}

function formatSyncHealth(status: GoogleCalendarConnectionStatus): string {
  if (!status.connected) return "—";
  if (status.sync_health_label === "healthy") return "Healthy";
  if (status.sync_health_label === "needs_attention") return "Needs attention";
  return "Not synced yet";
}

function statusBadgeClass(label: string): string {
  if (label === "Connected") return "bg-emerald-500/15 text-emerald-300";
  if (label === "Not connected") return "bg-slate-500/15 text-slate-300";
  return "bg-amber-500/15 text-amber-300";
}

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] py-2 last:border-b-0">
      <span className="text-sm text-[#94A3B8]">{label}</span>
      <span className="text-sm font-medium text-[#E2E8F0]">{value}</span>
    </div>
  );
}

export function GoogleCalendarIntegrationCard({
  tenantId,
  initialStatus,
  oauthConfigured,
  connectedFlash,
  errorFlash,
}: {
  tenantId: string;
  initialStatus: GoogleCalendarConnectionStatus;
  oauthConfigured: boolean;
  connectedFlash?: boolean;
  errorFlash?: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [validating, setValidating] = useState(false);
  const [validateMessage, setValidateMessage] = useState<string | null>(null);

  const connectionLabel = displayConnectionLabel(status);
  const connectHref = `/api/tenants/${tenantId}/integrations/google-calendar/oauth/start`;
  const connectLabel = status.connected ? "Reconnect Google Calendar" : "Connect Google Calendar";

  const onValidate = useCallback(async () => {
    setValidating(true);
    setValidateMessage(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/integrations/google-calendar/validate`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json()) as {
        success?: boolean;
        error?: string;
        connected?: boolean;
        status?: GoogleCalendarConnectionStatus["status"];
        google_account_email?: string | null;
        calendar_id?: string | null;
      };

      if (!res.ok) {
        setValidateMessage(body.error ?? "Validation request failed.");
        return;
      }

      setStatus((prev) => ({
        ...prev,
        connected: Boolean(body.connected),
        status: body.status ?? prev.status,
        google_account_email: body.google_account_email ?? prev.google_account_email,
        calendar_id: body.calendar_id ?? prev.calendar_id,
        last_synced_at: body.last_synced_at ?? prev.last_synced_at,
        last_sync_status: body.last_sync_status ?? prev.last_sync_status,
        sync_failure_count: body.sync_failure_count ?? prev.sync_failure_count,
        last_sync_error_summary: body.last_sync_error_summary ?? prev.last_sync_error_summary,
        last_validated_at: body.last_validated_at ?? prev.last_validated_at,
        sync_health_label: body.sync_health_label ?? prev.sync_health_label,
        can_create_meet: body.can_create_meet ?? prev.can_create_meet,
        token_expires_at: body.token_expires_at ?? prev.token_expires_at,
      }));

      setValidateMessage(
        body.success
          ? "Connection validated successfully."
          : (body.error ?? "Connection validation failed.")
      );
    } catch {
      setValidateMessage("Validation request failed.");
    } finally {
      setValidating(false);
    }
  }, [tenantId]);

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F8FAFC]">Google Calendar</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Native CalendarOS connector — OAuth tokens are encrypted server-side and never exposed to the browser.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(connectionLabel)}`}
        >
          {connectionLabel}
        </span>
      </div>

      {connectedFlash ? (
        <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Google Calendar connected successfully.
        </p>
      ) : null}

      {errorFlash ? (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Google Calendar connection failed ({errorFlash}). Try reconnecting.
        </p>
      ) : null}

      {!oauthConfigured ? (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Google Calendar OAuth is not configured on this deployment. Set{" "}
          <code className="text-[#22C1FF]">GOOGLE_CALENDAR_CLIENT_ID</code> (or{" "}
          <code className="text-[#22C1FF]">GOOGLE_CLIENT_ID</code>),{" "}
          <code className="text-[#22C1FF]">GOOGLE_CALENDAR_CLIENT_SECRET</code> (or{" "}
          <code className="text-[#22C1FF]">GOOGLE_CLIENT_SECRET</code>),{" "}
          <code className="text-[#22C1FF]">GOOGLE_CALENDAR_REDIRECT_URI</code> (or{" "}
          <code className="text-[#22C1FF]">GOOGLE_OAUTH_REDIRECT_URI</code>), and{" "}
          <code className="text-[#22C1FF]">FI_EXTERNAL_CONNECTOR_MASTER_KEY</code> for token
          encryption and OAuth state signing.
        </p>
      ) : null}

      <div className="mt-4 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-[#060d18]/60 px-3">
        <StatusRow label="Connected account" value={status.google_account_email ?? "—"} />
        <StatusRow label="Calendar ID" value={status.calendar_id ?? "—"} />
        <StatusRow label="Integration status" value={status.status} />
        <StatusRow label="Token expiry" value={formatTokenExpiry(status.token_expires_at)} />
        <StatusRow
          label="Last synced"
          value={
            status.last_synced_at
              ? new Date(status.last_synced_at).toLocaleString()
              : "Not synced yet"
          }
        />
        <StatusRow
          label="Sync health"
          value={
            <span className={syncHealthBadgeClass(formatSyncHealth(status))}>
              {formatSyncHealth(status)}
            </span>
          }
        />
        {status.last_sync_error_summary ? (
          <StatusRow label="Last sync error" value={status.last_sync_error_summary} />
        ) : null}
        <StatusRow
          label="Last validated"
          value={
            status.last_validated_at
              ? new Date(status.last_validated_at).toLocaleString()
              : "—"
          }
        />
        <StatusRow label="Google Meet ready" value={status.can_create_meet ? "Yes" : "No"} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {oauthConfigured ? (
          <Link
            href={connectHref}
            className="inline-flex items-center rounded-lg bg-[#22C1FF] px-4 py-2 text-sm font-medium text-[#0a1424] hover:bg-[#4dd4ff]"
          >
            {connectLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-lg bg-slate-600/40 px-4 py-2 text-sm font-medium text-slate-400"
          >
            {connectLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => onValidate()}
          disabled={validating || !status.connected}
          className="inline-flex items-center rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-[#E2E8F0] hover:border-white/20 disabled:opacity-50"
        >
          {validating ? "Validating…" : "Validate connection"}
        </button>
      </div>

      {validateMessage ? (
        <p className="mt-3 text-sm text-[#94A3B8]">{validateMessage}</p>
      ) : null}
    </section>
  );
}
