export const PRIMARY_NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/solutions", label: "Solutions" },
  { href: "/hair-intelligence", label: "Hair Intelligence" },
  { href: "/white-label", label: "White Label" },
  { href: "/methodology", label: "Methodology" },
  { href: "/dashboard-demo", label: "Dashboard Demo" },
  { href: "/future-verticals", label: "Future Verticals" },
  { href: "https://iiohr.com", label: "IIOHR" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const FOOTER_NAV = [
  ...PRIMARY_NAV,
  { href: "/modules", label: "Legacy Modules" },
  { href: "/integration", label: "Integration" },
  { href: "/security", label: "Security" },
  { href: "/licensing", label: "Licensing" },
];

export type EcosystemSiteId = "iiohr" | "hairaudit" | "follicleintelligence" | "hli";

/** Shared ecosystem band: tagline + 4 links. Use in footer and header for consistency. */
export const ECOSYSTEM_BAND = {
  tagline: "Part of the Surgical Intelligence Ecosystem™",
  links: [
    { id: "iiohr" as EcosystemSiteId, label: "IIOHR", role: "training", href: "https://iiohr.com" },
    { id: "hairaudit" as EcosystemSiteId, label: "HairAudit", role: "measurement", href: "https://hairaudit.com" },
    { id: "follicleintelligence" as EcosystemSiteId, label: "Follicle Intelligence", role: "analysis", href: "/" },
    { id: "hli" as EcosystemSiteId, label: "Hair Longevity Institute", role: "biology", href: "https://hairlongevityinstitute.com" },
  ],
};

/** Diagram node: central engine vs satellites. Same relationships across all ecosystem sites. */
export const ECOSYSTEM_DIAGRAM_NODES = {
  /** Central engine: Follicle Intelligence™ */
  central: {
    id: "follicleintelligence" as EcosystemSiteId,
    label: "Follicle Intelligence™",
    roleLabel: "Central engine",
    href: "/",
  },
  /** Satellites (order: HairAudit, HLI, IIOHR for consistent layout). */
  satellites: [
    { id: "hairaudit" as EcosystemSiteId, label: "HairAudit™", roleLabel: "Surgical audit and scoring", href: "https://hairaudit.com" },
    { id: "hli" as EcosystemSiteId, label: "Hair Longevity Institute™", roleLabel: "Diagnosis and treatment pathway", href: "https://hairlongevityinstitute.com" },
    { id: "iiohr" as EcosystemSiteId, label: "IIOHR™", roleLabel: "Training and certification", href: "https://iiohr.com" },
  ],
} as const;
