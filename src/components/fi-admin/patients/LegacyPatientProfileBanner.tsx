import Link from "next/link";

import type { LegacyPatientProfileBanner as LegacyPatientProfileBannerModel } from "@/src/lib/patients/legacyPatientVisibilityCore";
import { cn } from "@/lib/utils";

const BANNER_STYLES: Record<LegacyPatientProfileBannerModel["kind"], string> = {
  returning_timely: "border-sky-500/25 bg-sky-950/30 text-sky-100",
  historical_incomplete: "border-amber-500/25 bg-amber-950/25 text-amber-100",
  continue_care: "border-cyan-500/25 bg-cyan-950/25 text-cyan-100",
  ai_review_pending: "border-orange-500/25 bg-orange-950/25 text-orange-100",
  merge_review: "border-rose-500/25 bg-rose-950/25 text-rose-100",
};

export function LegacyPatientProfileBanner({
  banners,
  className,
}: {
  banners: readonly LegacyPatientProfileBannerModel[];
  className?: string;
}) {
  if (!banners.length) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {banners.map((banner) => (
        <div
          key={banner.kind}
          role="status"
          className={cn(
            "rounded-xl border px-4 py-3 text-sm shadow-sm",
            BANNER_STYLES[banner.kind]
          )}
        >
          <p className="font-semibold text-[#F8FAFC]">{banner.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{banner.description}</p>
          {banner.href || banner.secondaryHref ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {banner.href ? (
                <Link
                  href={banner.href}
                  className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  {banner.hrefLabel ?? "Open"}
                </Link>
              ) : null}
              {banner.secondaryHref ? (
                <Link
                  href={banner.secondaryHref}
                  className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/5"
                >
                  {banner.secondaryHrefLabel ?? "Open"}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}