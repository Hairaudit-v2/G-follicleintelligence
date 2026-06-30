"use client";

import { useCallback, useState } from "react";

import type { FiIntegrationWebhookEventRow } from "@/src/lib/integrations/timely/timelyWebhookEvents.types";

function MonoBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#060d18] p-3 text-xs leading-relaxed text-[#CBD5E1]">
      {children}
    </pre>
  );
}

function CopyLine({ label, text }: { label: string; text: string }) {
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
    </div>
  );
}

export function TimelyDiscoveryInspector({
  webhookUrl,
  events,
}: {
  webhookUrl: string;
  events: FiIntegrationWebhookEventRow[];
}) {
  const authHeaderLine = "Authorization: Bearer <FI_TIMELY_WEBHOOK_SECRET>";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Zapier webhook</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          POST JSON from Webhooks by Zapier. Same bearer secret as production Timely routes.
          Payloads are stored for inspection only.
        </p>
        <div className="mt-4 space-y-3">
          <CopyLine label="Webhook URL" text={webhookUrl} />
          <CopyLine label="Required header" text={authHeaderLine} />
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0a1424]/80 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Last 20 Timely webhook events</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Rows from{" "}
          <code className="rounded bg-[#141C33] px-1 py-0.5 font-mono text-xs text-[#22C1FF]">
            fi_integration_webhook_events
          </code>{" "}
          with provider timely.
        </p>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">
            No events recorded yet. Fire a test Zap pointing at the URL above.
          </p>
        ) : (
          <ul className="mt-4 space-y-6">
            {events.map((ev) => (
              <li key={ev.id} className="rounded-lg border border-white/[0.06] bg-[#060d18]/40 p-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                  <span>
                    <span className="text-[#64748B]">created_at</span>{" "}
                    <span className="font-mono text-[#CBD5E1]">{ev.created_at}</span>
                  </span>
                  <span>
                    <span className="text-[#64748B]">event_type</span>{" "}
                    <span className="font-mono text-[#22C1FF]">{ev.event_type}</span>
                  </span>
                  <span>
                    <span className="text-[#64748B]">status</span>{" "}
                    <span className="font-mono text-[#CBD5E1]">{ev.status}</span>
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-[#64748B]">
                  route <span className="text-[#94A3B8]">{ev.route}</span>
                </p>
                <p className="mt-1 font-mono text-[10px] text-[#64748B]">
                  id {ev.id}
                  {ev.payload_hash ? ` · sha256 ${ev.payload_hash}` : null}
                </p>
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                    payload
                  </p>
                  <MonoBlock>{JSON.stringify(ev.payload, null, 2)}</MonoBlock>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
