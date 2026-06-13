import type { NetworkPlatform } from "./tokens";

export type NetworkProductSlug =
  | "follicle-intelligence"
  | "hairaudit"
  | "hli"
  | "iiohr";

export type NetworkProduct = {
  slug: NetworkProductSlug;
  name: string;
  category: string;
  description: string;
  /** Maps to shared theme tokens */
  platform: NetworkPlatform;
};

/**
 * Core products in the Follicle Intelligence Network (Evolved Hair intentionally excluded).
 */
export const NETWORK_PRODUCTS: readonly NetworkProduct[] = [
  {
    slug: "follicle-intelligence",
    name: "Follicle Intelligence",
    category: "Operating System",
    description: "The operating system for the global hair restoration industry.",
    platform: "fi",
  },
  {
    slug: "hairaudit",
    name: "HairAudit",
    category: "Outcome Verification",
    description: "Surgical quality assurance and outcome intelligence for hair restoration.",
    platform: "hairaudit",
  },
  {
    slug: "hli",
    name: "Hair Longevity Institute",
    category: "Diagnostics",
    description: "Intelligent hair loss diagnostics, blood analysis and treatment planning.",
    platform: "hli",
  },
  {
    slug: "iiohr",
    name: "IIOHR",
    category: "Education",
    description: "Training, certification and standards for hair restoration medicine.",
    platform: "iiohr",
  },
] as const;

export function getNetworkProduct(slug: NetworkProductSlug): NetworkProduct | undefined {
  return NETWORK_PRODUCTS.find((p) => p.slug === slug);
}

export const NETWORK_BADGE_COPY = "Part of the Follicle Intelligence Network" as const;

export const NETWORK_ECOSYSTEM_STATEMENT =
  "A connected intelligence layer for verification, diagnostics, education, and clinical infrastructure across hair restoration." as const;
