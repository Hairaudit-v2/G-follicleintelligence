"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createExternalConnectorAction,
  updateExternalConnectorAction,
} from "@/lib/actions/fi-onboarding-os-external-connector-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { groupConnectorCatalogByCategory } from "@/src/lib/onboarding-os/externalConnectorCore";
import type {
  ExternalConnectorCatalogEntry,
  ExternalConnectorHealthStatus,
  ExternalConnectorIntegrationRow,
  ExternalConnectorProvider,
  TenantExternalConnectorsSnapshot,
} from "@/src/lib/onboarding-os/externalConnectorTypes";
import {
  EXTERNAL_CONNECTOR_STATUS_BADGES,
} from "@/src/lib/onboarding-os/externalConnectorTypes";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

const HEALTH_BAND_CLASSES: Record<string, string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  unhealthy: "text-red-400",
  unknown: "text-slate-400",
};

type Props = {
  snapshot: TenantExternalConnectorsSnapshot;
  mode: "platform" | "tenant";
  sessionId?: string | null;
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[tone] ?? BADGE_CLASSES.neutral}`}>
      {label}
    </span>
  );
}

function ConnectorCard({
  integration,
  health,
}: {
  integration: ExternalConnectorIntegrationRow;
  health: ExternalConnectorHealthStatus | undefined;
}) {
  const badge = EXTERNAL_CONNECTOR_STATUS_BADGES[integration.status];
  const band = health?.healthBand ?? "unknown";

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{integration.displayName}</p>
          <p className="text-xs text-slate-400">{integration.provider.replace(/_/g, " ")}</p>
        </div>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-400">
        <p>
          Health:{" "}
          <span className={HEALTH_BAND_CLASSES[band] ?? HEALTH_BAND_CLASSES.unknown}>
            {health?.healthScore ?? 0}% · {band}
          </span>
        </p>
        <p>Credentials: {integration.credentialConfigured ? "Stored (encrypted)" : "Not configured"}</p>
        <p>Sync mode: {integration.syncMode.replace(/_/g, " ")} · Live sync: not available yet</p>
        {health?.summary ? <p className="text-slate-500">{health.summary}</p> : null}
      </div>
    </div>
  );
}

function CatalogProviderButton({
  entry,
  configured,
  disabled,
  onSelect,
}: {
  entry: ExternalConnectorCatalogEntry;
  configured: boolean;
  disabled: boolean;
  onSelect: (provider: ExternalConnectorProvider) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || configured}
      onClick={() => onSelect(entry.provider)}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
        configured
          ? "cursor-not-allowed border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
          : "border-slate-700/60 bg-slate-900/30 text-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/5 disabled:opacity-50"
      }`}
    >
      <span className="font-medium">{entry.label}</span>
      {configured ? (
        <span className="ml-2 text-xs text-emerald-400">Connected</span>
      ) : (
        <p className="mt-1 text-xs text-slate-500">{entry.description}</p>
      )}
    </button>
  );
}

export function ConnectExistingSystemsPanel({ snapshot: initialSnapshot, mode, sessionId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ExternalConnectorProvider | null>(null);
  const [credential, setCredential] = useState("");

  const grouped = groupConnectorCatalogByCategory(snapshot.catalog);
  const configuredProviders = new Set(snapshot.integrations.map((i) => i.provider));
  const healthById = new Map(snapshot.healthStatuses.map((h) => [h.integrationId, h]));

  function runCreate(provider: ExternalConnectorProvider) {
    setMessage(null);
    startTransition(async () => {
      const entry = snapshot.catalog.find((c) => c.provider === provider);
      if (!entry) return;

      const config: Record<string, string> = {};
      for (const field of entry.configFields) {
        if (field.sensitive) continue;
        config[field.key] = field.key.includes("email")
          ? "pending@example.com"
          : field.key.includes("id")
            ? "pending"
            : "pending";
      }

      const res = await createExternalConnectorAction(
        snapshot.tenantId,
        {
          provider,
          config,
          credentialPlaintext: credential.trim() || "architecture-placeholder-key",
          syncMode: "manual",
        },
        sessionId
      );

      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      if (res.snapshot) setSnapshot(res.snapshot);
      setSelectedProvider(null);
      setCredential("");
      setMessage({ kind: "ok", text: `${entry.label} connector registered (architecture mode — no live sync).` });
      router.refresh();
    });
  }

  function pauseConnector(integration: ExternalConnectorIntegrationRow) {
    setMessage(null);
    startTransition(async () => {
      const res = await updateExternalConnectorAction(
        snapshot.tenantId,
        integration.id,
        { status: integration.status === "paused" ? "configured" : "paused" },
        sessionId
      );
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      if (res.snapshot) setSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Connector status updated." });
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5 space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase F1</p>
        <h2 className="text-lg font-semibold text-slate-50">Connect Existing Systems</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Register legacy CRM, calendar, finance, and marketing systems for coexistence during onboarding.
          Architecture foundation only — no OAuth, webhooks, or live API sync yet.
        </p>
      </div>

      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      ) : null}

      {snapshot.integrations.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Registered connectors</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.integrations.map((integration) => (
              <div key={integration.id} className="space-y-2">
                <ConnectorCard integration={integration} health={healthById.get(integration.id)} />
                {mode === "platform" || mode === "tenant" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => pauseConnector(integration)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                  >
                    {integration.status === "paused" ? "Resume connector" : "Pause connector"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No external systems connected yet.</p>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-300">Available connectors</h3>
        {Object.entries(grouped).map(([categoryLabel, entries]) => (
          <div key={categoryLabel} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{categoryLabel}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <CatalogProviderButton
                  key={entry.provider}
                  entry={entry}
                  configured={configuredProviders.has(entry.provider)}
                  disabled={pending}
                  onSelect={setSelectedProvider}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedProvider ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-100">
            Register {snapshot.catalog.find((c) => c.provider === selectedProvider)?.label}
          </p>
          <p className="text-xs text-slate-400">
            Enter placeholder credential material for architecture testing. Credentials are encrypted at rest; no external API calls are made.
          </p>
          <input
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="API key or token (placeholder)"
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => runCreate(selectedProvider)}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Register connector
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setSelectedProvider(null);
                setCredential("");
              }}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
