import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import type { NetworkProductSlug } from "./ecosystem";
import { getNetworkProduct } from "./ecosystem";
import { platformColorTokens } from "./tokens";

export type NetworkProductPillProps = {
  slug: NetworkProductSlug;
  name: string;
  category: string;
  href?: string;
  active?: boolean;
  className?: string;
  trailing?: ReactNode;
};

export function NetworkProductPill({
  slug,
  name,
  category,
  href,
  active,
  className,
  trailing,
}: NetworkProductPillProps) {
  const product = getNetworkProduct(slug);
  const platform = product?.platform ?? "fi";
  const accent = platformColorTokens[platform];

  const inner = (
    <span
      className={cn(
        "flex min-w-0 flex-col rounded-full border px-4 py-2 transition-colors",
        active ? `${accent.accentBorder} bg-white/[0.07]` : "border-white/10 bg-white/[0.03] hover:border-white/16",
        className
      )}
    >
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {category}
      </span>
      <span className={cn("truncate text-sm font-semibold text-foreground", accent.accentText)}>{name}</span>
      {trailing ? <span className="mt-1 text-xs text-muted-foreground">{trailing}</span> : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex max-w-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
