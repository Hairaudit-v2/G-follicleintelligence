import Link from "next/link";
import type { PatientTimelineItem } from "@/src/lib/patients/timeline/patientTimelineTypes";
import { patientTimelineItemTypeLabel } from "@/src/lib/patients/timeline/patientTimelineLabels";
import { PatientTimelineBadge } from "./PatientTimelineBadge";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function PatientTimelineItem({
  item,
  thumbnailUrl,
}: {
  item: PatientTimelineItem;
  thumbnailUrl?: string | null;
}) {
  const typeHint = patientTimelineItemTypeLabel(item.item_type);
  return (
    <li className="flex gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
      {thumbnailUrl && item.item_type === "image_uploaded" ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-white/[0.08] bg-white/[0.03]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="" width={48} height={48} className="h-12 w-12 object-cover" />
        </div>
      ) : (
        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <PatientTimelineBadge sourceType={item.source_type} />
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{typeHint}</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100">{item.title}</p>
          <time className="shrink-0 text-xs text-gray-500" dateTime={item.occurred_at}>
            {fmt(item.occurred_at)}
          </time>
        </div>
        {item.subtitle ? <p className="text-xs text-slate-400">{item.subtitle}</p> : null}
        {item.metadata_summary ? <p className="text-xs text-gray-500">{item.metadata_summary}</p> : null}
        <div className="flex flex-wrap gap-2 text-xs">
          {item.href ? (
            <Link href={item.href} className="font-medium text-blue-300 hover:underline">
              Open linked record
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
