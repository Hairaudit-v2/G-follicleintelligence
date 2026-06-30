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

const EVOLVED_LOGO_BASENAME = "evolved-logo.png";

/** Normalizes tenant/public logo references to a root-relative `/public` path. */
export function normalizePublicImagePath(input: string | null | undefined): string | null {
  const t = input?.trim();
  if (!t || t.length > 2048 || t.includes("..")) return null;

  let candidate = t.split(/[?#]/)[0]?.trim() ?? "";
  if (!candidate) return null;

  if (candidate.includes("://")) {
    try {
      candidate = new URL(candidate).pathname;
    } catch {
      return null;
    }
  }

  if (!candidate.startsWith("/")) {
    candidate = `/${candidate}`;
  }

  if (candidate.length > 256) return null;
  return candidate;
}

export function isEvolvedLogoPath(path: string | null | undefined): boolean {
  const normalized = normalizePublicImagePath(path);
  if (!normalized) return false;
  return (
    normalized === PUBLIC_IMAGE_PATHS.evolvedLogo ||
    normalized.endsWith(`/${EVOLVED_LOGO_BASENAME}`)
  );
}

export function resolvePublicStaticImage(path: string | null | undefined): StaticImageData | null {
  const normalized = normalizePublicImagePath(path);
  if (!normalized) return null;
  return PUBLIC_IMAGE_BY_PATH[normalized] ?? null;
}
