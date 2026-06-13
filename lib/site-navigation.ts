export const PRIMARY_NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/surgeons", label: "Surgeons" },
  { href: "/clinic-owners", label: "Clinic owners" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/academy", label: "Academy" },
  { href: "/audit-network", label: "Audit network" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/about", label: "About" },
];

export type FooterNavLink = { label: string; href: string };

/** Public footer — primary OS story routes */
export const FOOTER_PLATFORM: FooterNavLink[] = [
  { label: "Platform", href: "/platform" },
  { label: "Surgeons", href: "/surgeons" },
  { label: "Clinic owners", href: "/clinic-owners" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Academy", href: "/academy" },
  { label: "Audit network", href: "/audit-network" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "Book demo", href: "/demo" },
];

/** Public footer — product modules (deep links) */
export const FOOTER_MODULES: FooterNavLink[] = [
  { label: "SurgeryOS", href: "/platform/surgery-os" },
  { label: "PatientOS", href: "/platform/patient-os" },
  { label: "ImagingOS", href: "/platform/imaging-os" },
  { label: "ClinicOS", href: "/platform/clinic-os" },
  { label: "LeadFlow", href: "/platform/leadflow" },
  { label: "AnalyticsOS", href: "/platform/analytics-os" },
];

/** Ecosystem (external) — full names for clarity */
export const FOOTER_INTELLIGENCE_LAYERS: FooterNavLink[] = [
  { label: "HairAudit", href: "https://hairaudit.com" },
  { label: "Hair Longevity Institute", href: "https://hairlongevityinstitute.com" },
  { label: "International Institute of Hair Restoration", href: "https://iiohr.com" },
];

export const FOOTER_COMPANY: FooterNavLink[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Solutions", href: "/solutions" },
  { label: "Hair intelligence", href: "/hair-intelligence" },
  { label: "Methodology", href: "/methodology" },
];

export type EcosystemSiteId = "iiohr" | "hairaudit" | "follicleintelligence" | "hli";

/** Shared ecosystem band: tagline + 4 links. Use in footer and header for consistency. */
export const ECOSYSTEM_BAND = {
  tagline: "Connected intelligence across outcomes, diagnostics, and standards",
  links: [
    { id: "iiohr" as EcosystemSiteId, label: "International Institute of Hair Restoration", role: "training", href: "https://iiohr.com" },
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
    roleLabel: "Platform core",
    href: "/",
  },
  /** Satellites (order: HairAudit, HLI, IIOHR for consistent layout). */
  satellites: [
    {
      id: "hairaudit" as EcosystemSiteId,
      label: "HairAudit™",
      roleLabel: "Surgical audit and scoring",
      href: "https://hairaudit.com",
    },
    {
      id: "hli" as EcosystemSiteId,
      label: "Hair Longevity Institute™",
      roleLabel: "Diagnosis and treatment pathway",
      href: "https://hairlongevityinstitute.com",
    },
    {
      id: "iiohr" as EcosystemSiteId,
      label: "International Institute of Hair Restoration™",
      roleLabel: "Training and certification",
      href: "https://iiohr.com",
    },
  ],
} as const;
