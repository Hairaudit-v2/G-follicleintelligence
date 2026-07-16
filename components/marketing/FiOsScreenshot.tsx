import Image from "next/image";

import { cn } from "@/lib/utils";
import type { FiOsScreenshotAsset } from "@/lib/marketing/fiosScreenshots";

export type FiOsScreenshotProps = {
  asset: FiOsScreenshotAsset;
  /** Prefer visionCaption / visionEyebrow when true */
  variant?: "default" | "vision";
  /** Larger featured treatment */
  featured?: boolean;
  priority?: boolean;
  className?: string;
  /** Override caption */
  caption?: string;
  eyebrow?: string;
  sizes?: string;
};

/**
 * Canonical marketing frame for FI OS product screenshots.
 * No fake browser chrome — subtle border + light panel separation for dark UI.
 */
export function FiOsScreenshot({
  asset,
  variant = "default",
  featured = false,
  priority = false,
  className,
  caption,
  eyebrow,
  sizes,
}: FiOsScreenshotProps) {
  const label = eyebrow ?? (variant === "vision" ? asset.visionEyebrow : asset.eyebrow);
  const body = caption ?? (variant === "vision" ? asset.visionCaption : asset.caption);
  const aspect = "aspect-[16/10]";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-cyan-400/15",
        "bg-gradient-to-br from-[rgb(14_20_32_/0.96)] via-[rgb(8_12_20_/0.94)] to-[rgb(4_7_14_/0.98)]",
        "shadow-[0_24px_72px_rgb(0_0_0_/0.45),inset_0_1px_0_rgb(255_255_255_/0.06)]",
        "transition-[transform,box-shadow,border-color] duration-500 ease-out",
        "hover:-translate-y-0.5 hover:border-cyan-300/25 hover:shadow-[0_32px_88px_rgb(0_0_0_/0.5),0_0_40px_rgb(42_168_220_/0.06)]",
        featured && "lg:flex-row lg:items-stretch",
        className
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden border-b border-white/[0.06] bg-[rgb(6_10_18)] p-2 sm:p-2.5",
          featured && "border-b lg:w-[62%] lg:border-b-0 lg:border-r lg:border-white/[0.06]",
          aspect
        )}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[0.95rem] border border-white/[0.08] bg-black/40">
          <Image
            src={asset.src}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            sizes={
              sizes ??
              (featured
                ? "(max-width: 1024px) 100vw, 62vw"
                : "(max-width: 1024px) 100vw, 50vw")
            }
            className="h-full w-full object-cover object-top"
            priority={priority}
          />
        </div>
      </div>
      <div
        className={cn(
          "relative flex flex-1 flex-col justify-center space-y-2 px-5 py-5 sm:px-6 sm:py-6",
          featured && "lg:px-8 lg:py-8"
        )}
      >
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75 sm:text-[11px]">
          {label}
        </p>
        <p
          className={cn(
            "text-sm leading-relaxed text-muted-foreground/95 sm:text-[0.9375rem]",
            featured && "sm:text-base"
          )}
        >
          {body}
        </p>
      </div>
    </article>
  );
}
