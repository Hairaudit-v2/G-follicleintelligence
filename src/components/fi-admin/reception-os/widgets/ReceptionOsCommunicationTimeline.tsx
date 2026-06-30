import Link from "next/link";
import { Mail, MessageSquare, Phone, StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import type { ReceptionOsCommunicationEvent } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

function kindIcon(kind: ReceptionOsCommunicationEvent["kind"]) {
  switch (kind) {
    case "sms":
      return MessageSquare;
    case "email":
      return Mail;
    case "call":
      return Phone;
    case "consultation_note":
      return StickyNote;
    default:
      return MessageSquare;
  }
}

function kindLabel(kind: ReceptionOsCommunicationEvent["kind"]): string {
  switch (kind) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    case "call":
      return "Call";
    case "consultation_note":
      return "Consultation note";
    default:
      return "Message";
  }
}

function formatRelativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ReceptionOsCommunicationTimelineWidget({
  events,
}: {
  events: ReceptionOsCommunicationEvent[];
}) {
  return (
    <DashboardCard className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title="Communication timeline" description="Recent patient interactions" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {events.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            No recent communications logged.
          </p>
        ) : (
          <ul className="relative space-y-0 pl-1 before:absolute before:bottom-2 before:left-[1.15rem] before:top-2 before:w-px before:bg-white/[0.08]">
            {events.map((ev) => {
              const Icon = kindIcon(ev.kind);
              const primaryHref = receptionOsPrimaryHref(ev.hrefs);
              const body = (
                <>
                  <div className="flex min-w-0 flex-1 gap-3 py-2">
                    <span
                      className={cn(
                        "relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                        ev.kind === "consultation_note"
                          ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                          : "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {kindLabel(ev.kind)}
                        </span>
                        <span className="text-[0.65rem] text-slate-600">
                          {formatRelativeTime(ev.contactAt)}
                        </span>
                        <span className="text-[0.65rem] capitalize text-slate-600">
                          {ev.direction}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-slate-100">
                        {ev.patientOrLeadLabel}
                      </p>
                      {ev.subject ? (
                        <p className="truncate text-xs text-slate-400">{ev.subject}</p>
                      ) : null}
                      {ev.preview ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">
                          {ev.preview}
                        </p>
                      ) : null}
                      <ReceptionOsRecordLinks hrefs={ev.hrefs} className="mt-1.5" />
                    </div>
                  </div>
                </>
              );
              return (
                <li key={ev.id}>
                  {primaryHref ? (
                    <Link
                      href={primaryHref}
                      className="block rounded-lg px-2 transition hover:bg-white/[0.03]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
