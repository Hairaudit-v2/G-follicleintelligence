"use client";

/**
 * Stays client-only: all current importers are client shells (`FiOsSidebar`, `ClinicOsShell`,
 * `FiTenantBrandFrame`). Next.js forbids importing a Server Component from them. We also use
 * `onError` + `useState` to hide broken tenant logos without changing the happy-path layout.
 */
import Image from "next/image";
import { useState } from "react";

import { EvolvedLogoImage } from "@/src/components/brand/EvolvedLogoImage";
import { isEvolvedLogoPath } from "@/src/lib/brand/publicImages";
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

function resolveNextImageLoading(
  priority: boolean | undefined,
  loading: "lazy" | "eager"
): { priority: true } | { priority: false; loading: "lazy" | "eager" } | { loading: "lazy" | "eager" } {
  if (priority) return { priority: true };
  if (priority === false) return { priority: false, loading };
  return { loading };
}

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

  if (isEvolvedLogoPath(logoUrl)) {
    return (
      <EvolvedLogoImage
        alt={alt}
        width={width}
        height={height}
        className={className}
        {...resolveNextImageLoading(priority ?? true, loading)}
        onError={() => setHide(true)}
      />
    );
  }

  const fetchProps = resolveNextImageLoading(priority, loading);

  if (source.kind === "static") {
    return (
      <Image
        src={source.image}
        alt={alt}
        width={width}
        height={height}
        className={className}
        {...fetchProps}
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
      {...fetchProps}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setHide(true)}
    />
  );
}
