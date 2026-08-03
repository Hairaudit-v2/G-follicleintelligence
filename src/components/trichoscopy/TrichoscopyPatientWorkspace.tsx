"use client";

import { useState } from "react";

import { TrichoscopyRequestModal } from "@/src/components/trichoscopy/TrichoscopyRequestModal";
import { TrichoscopyStatusCard } from "@/src/components/trichoscopy/TrichoscopyStatusCard";
import type { FiosTrichoscopyStatus } from "@/src/lib/integrations/hliTrichoscopy/types";
import type { TrichoscopyCapability } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

export function TrichoscopyPatientWorkspace(props: {
  tenantId: string;
  patientId: string;
  links: Array<{
    id: string;
    purpose: string;
    status: FiosTrichoscopyStatus;
    requestedAt: string | null;
    lastSyncedAt: string | null;
    episodeId: string | null;
  }>;
  packsByLink: Record<string, Array<Record<string, unknown>>>;
  openActions: Array<Record<string, unknown>>;
  canRequest: boolean;
  openRequestModal: boolean;
  historicalReadOnly: boolean;
  enabledCapabilities: TrichoscopyCapability[];
}) {
  const [requestOpen, setRequestOpen] = useState(props.openRequestModal);
  const showSurgical = props.enabledCapabilities.includes("trichoscopy.surgical_planning");
  const showLongitudinal = props.enabledCapabilities.includes("trichoscopy.longitudinal");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {props.canRequest && !props.historicalReadOnly ? (
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Request trichoscopy
          </button>
        ) : null}
        {!showSurgical ? (
          <span className="rounded border border-white/[0.08] px-2 py-1 text-xs text-slate-500">
            Surgical planning not included
          </span>
        ) : null}
        {!showLongitudinal ? (
          <span className="rounded border border-white/[0.08] px-2 py-1 text-xs text-slate-500">
            Longitudinal monitoring not included
          </span>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Episodes</h2>
        {!props.links.length ? (
          <p className="text-sm text-slate-500">No trichoscopy episodes linked yet.</p>
        ) : (
          props.links.map((link) => {
            const packs = props.packsByLink[link.id] ?? [];
            const active = packs.find((p) => p.local_state === "active");
            const action = props.openActions.find((a) => a.link_id === link.id);
            return (
              <TrichoscopyStatusCard
                key={link.id}
                tenantId={props.tenantId}
                patientId={props.patientId}
                linkId={link.id}
                purpose={link.purpose}
                status={link.status}
                episodeCreatedAt={link.requestedAt}
                lastSyncedAt={link.lastSyncedAt}
                latestConfirmedLabel={
                  active
                    ? `${String(active.pack_type)} v${String(active.pack_version)}`
                    : null
                }
                limitations={Array.isArray(active?.limitations) ? (active.limitations as string[]) : []}
                outstandingAction={action ? String(action.title) : null}
                historicalReadOnly={props.historicalReadOnly}
                canRequest={props.canRequest}
              />
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Evidence-pack history</h2>
        {Object.values(props.packsByLink).flat().length === 0 ? (
          <p className="text-sm text-slate-500">No imported confirmed packs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {Object.entries(props.packsByLink).flatMap(([linkId, packs]) =>
              packs.map((p) => (
                <li
                  key={String(p.id)}
                  className="rounded-lg border border-white/[0.06] px-3 py-2"
                >
                  <span className="font-medium text-slate-100">{String(p.pack_type)}</span>
                  {" · "}v{String(p.pack_version)} · {String(p.local_state)} · link {linkId.slice(0, 8)}
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Outstanding actions</h2>
        {!props.openActions.length ? (
          <p className="text-sm text-slate-500">No open trichoscopy actions.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {props.openActions.map((a) => (
              <li key={String(a.id)} className="rounded-lg border border-white/[0.06] px-3 py-2">
                {String(a.title)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <TrichoscopyRequestModal
        tenantId={props.tenantId}
        patientId={props.patientId}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        hasActiveRequest={props.links.some((l) =>
          ["requested", "capture_due", "capture_in_progress", "review_pending"].includes(l.status)
        )}
      />
    </div>
  );
}
