import Image from "next/image";

import { cn } from "@/lib/utils";
import type { PatientAppScreenshotAsset } from "@/lib/marketing/patientAppScreenshots";

export type PatientAppPhoneScreenshotProps = {
  asset: PatientAppScreenshotAsset;
  className?: string;
  priority?: boolean;
};

/**
 * Marketing phone frame for FI Patient App screenshots.
 * Adds outline, radius, shadow and caption — does not alter screenshot content.
 */
export function PatientAppPhoneScreenshot({
  asset,
  className,
  priority = false,
}: PatientAppPhoneScreenshotProps) {
  return (
    <figure
      className={cn(
        "group flex h-full flex-col items-center gap-4",
        className
      )}
    >
      <div
        className={cn(
          "relative w-full max-w-[280px] overflow-hidden rounded-[1.75rem]",
          "border border-cyan-400/20 bg-gradient-to-b from-[rgb(14_20_32)] to-[rgb(4_7_14)]",
          "p-2 shadow-[0_28px_80px_rgb(0_0_0_/0.5),inset_0_1px_0_rgb(255_255_255_/0.06)]",
          "transition-[transform,box-shadow,border-color] duration-500 ease-out",
          "hover:-translate-y-1 hover:border-cyan-300/30"
        )}
      >
        <div className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-black/50">
          <Image
            src={asset.src}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            sizes="(max-width: 768px) 70vw, 280px"
            className="h-auto w-full object-cover object-top"
            priority={priority}
          />
        </div>
      </div>
      <figcaption className="max-w-[280px] text-center">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
          {asset.eyebrow}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{asset.caption}</p>
      </figcaption>
    </figure>
  );
}
