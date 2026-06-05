import type { StaticImageData } from "next/image";

import androidChrome196 from "@/public/icons/android-chrome-196x196.png";
import appleTouchIcon from "@/public/icons/apple-touch-icon.png";
import favicon32 from "@/public/icons/favicon-32x32.png";
import evolvedLogo from "@/public/evolved-logo.png";
import follicleLogoBlack from "@/public/brand/follicle-intelligence-logo-black.svg";
import follicleLogoWhite from "@/public/brand/follicle-intelligence-logo-white.svg";

/** Known static assets under `/public` — import for Next.js `Image` (avoids CORB-prone string paths). */
export const PUBLIC_IMAGES = {
  evolvedLogo,
  follicleLogoWhite,
  follicleLogoBlack,
  favicon32,
  appleTouchIcon,
  androidChrome196,
} as const;

/** Maps same-origin public URL paths to bundled static imports. */
export const PUBLIC_IMAGE_BY_PATH: Record<string, StaticImageData> = {
  "/evolved-logo.png": PUBLIC_IMAGES.evolvedLogo,
  "/brand/follicle-intelligence-logo-white.svg": PUBLIC_IMAGES.follicleLogoWhite,
  "/brand/follicle-intelligence-logo-black.svg": PUBLIC_IMAGES.follicleLogoBlack,
  "/icons/favicon-32x32.png": PUBLIC_IMAGES.favicon32,
  "/icons/apple-touch-icon.png": PUBLIC_IMAGES.appleTouchIcon,
  "/icons/android-chrome-196x196.png": PUBLIC_IMAGES.androidChrome196,
};

/** Canonical public URL paths (for metadata / JSON-LD). */
export const PUBLIC_IMAGE_PATHS = {
  evolvedLogo: "/evolved-logo.png",
  follicleLogoWhite: "/brand/follicle-intelligence-logo-white.svg",
  follicleLogoBlack: "/brand/follicle-intelligence-logo-black.svg",
  favicon32: "/icons/favicon-32x32.png",
  appleTouchIcon: "/icons/apple-touch-icon.png",
  androidChrome196: "/icons/android-chrome-196x196.png",
} as const;

/** Normalizes a root-relative public path; rejects traversal and off-origin URLs. */
export function normalizePublicImagePath(input: string | null | undefined): string | null {
  const t = input?.trim();
  if (!t || t.length > 256) return null;
  if (!t.startsWith("/") || t.includes("://") || t.includes("..")) return null;
  const path = t.split(/[?#]/)[0];
  return path || null;
}

export function resolvePublicStaticImage(path: string | null | undefined): StaticImageData | null {
  const normalized = normalizePublicImagePath(path);
  if (!normalized) return null;
  return PUBLIC_IMAGE_BY_PATH[normalized] ?? null;
}
