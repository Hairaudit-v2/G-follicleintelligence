"use client";

import Image from "next/image";
import { useState } from "react";

import { resolveTenantLogoSource } from "@/src/lib/brand/resolveTenantLogo";

type BrandLogoImageProps = {
  logoUrl: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
};

/**
 * Tenant / clinic logo via Next.js Image — local public imports or validated remote http(s) URLs.
 */
export function BrandLogoImage({
  logoUrl,
  alt,
  width,
  height,
  className,
  loading = "lazy",
  priority,
}: BrandLogoImageProps) {
  const [hide, setHide] = useState(false);
  const source = resolveTenantLogoSource(logoUrl);

  if (hide || !source) return null;

  if (source.kind === "static") {
    return (
      <Image
        src={source.image}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={loading}
        priority={priority}
        onError={() => setHide(true)}
      />
    );
  }

  return (
    <Image
      src={source.url}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      priority={priority}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setHide(true)}
    />
  );
}
