"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";

import {
  buildStaffHrTaskMapBannerHref,
  resolveStaffHrTaskMapBanner,
  type StaffHrTaskMapBannerSurface,
} from "@/src/lib/workforce/staffHrTaskMapBannerCore";
import { cn } from "@/lib/utils";

export function StaffHrTaskMapEntryBanner({
  tenantId,
  surface,
  staffId,
  className,
}: {
  tenantId: string;
  surface: StaffHrTaskMapBannerSurface;
  staffId?: string;
  className?: string;
}) {
  const preset = resolveStaffHrTaskMapBanner(surface);
  const href = buildStaffHrTaskMapBannerHref(tenantId, surface, staffId);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[#22C1FF]/20 bg-[#22C1FF]/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      data-testid={`hr-task-map-banner-${surface}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <CircleHelp
          className="mt-0.5 h-4 w-4 shrink-0 text-[#7DD3FC]"
          aria-hidden
        />
        <p className="text-sm text-[#CBD5E1]">{preset.message}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-lg border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-3 py-1.5 text-center text-xs font-semibold text-[#7DD3FC] transition-colors hover:bg-[#22C1FF]/20"
        data-testid={`hr-task-map-banner-link-${surface}`}
      >
        {preset.linkLabel}
      </Link>
    </div>
  );
}
