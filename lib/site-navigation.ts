export const PRIMARY_NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/solutions", label: "Solutions" },
  { href: "/hair-intelligence", label: "Hair Intelligence" },
  { href: "/white-label", label: "White Label" },
  { href: "/methodology", label: "Standards & governance" },
  { href: "/dashboard-demo", label: "Dashboard Demo" },
  { href: "/future-verticals", label: "Future Verticals" },
  { href: "https://iiohr.com", label: "IIOHR" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export type FooterNavLink = { label: string; href: string };

/** Public footer — Platform column */
export const FOOTER_PLATFORM: FooterNavLink[] = [
  { label: "Platform Overview", href: "/" },
  { label: "Technology", href: "/technology" },
  { label: "Patient Twin", href: "/patient-twin" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/technology" },
  { label: "Enterprise", href: "/technology" },
];

/** Public footer — product modules */
export const FOOTER_MODULES: FooterNavLink[] = [
  { label: "SurgeryOS", href: "/platform/surgery-os" },
  { label: "PatientOS", href: "/platform/patient-os" },
  { label: "ImagingOS", href: "/platform/imaging-os" },
  { label: "ClinicOS", href: "/platform/clinic-os" },
  { label: "LeadFlow", href: "/platform/leadflow" },
  { label: "AnalyticsOS", href: "/platform/analytics-os" },
];

/** Supporting intelligence layers (external) */
export const FOOTER_INTELLIGENCE_LAYERS: FooterNavLink[] = [
  { label: "HairAudit", href: "https://hairaudit.com" },
  { label: "HLI", href: "https://hairlongevityinstitute.com" },
  { label: "IIOHR", href: "https://iiohr.com" },
];

export const FOOTER_COMPANY: FooterNavLink[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Book Demo", href: "/contact?intent=demo" },
];

export type EcosystemSiteId = "iiohr" | "hairaudit" | "follicleintelligence" | "hli";

/** Shared ecosystem band: tagline + 4 links. Use in footer and header for consistency. */
export const ECOSYSTEM_BAND = {
  tagline: "Connected intelligence across outcomes, diagnostics, and standards",
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
    roleLabel: "Platform core",
    href: "/",
  },
  /** Satellites (order: HairAudit, HLI, IIOHR for consistent layout). */
  satellites: [
    { id: "hairaudit" as EcosystemSiteId, label: "HairAudit™", roleLabel: "Surgical audit and scoring", href: "https://hairaudit.com" },
    { id: "hli" as EcosystemSiteId, label: "Hair Longevity Institute™", roleLabel: "Diagnosis and treatment pathway", href: "https://hairlongevityinstitute.com" },
    { id: "iiohr" as EcosystemSiteId, label: "IIOHR™", roleLabel: "Training and certification", href: "https://iiohr.com" },
  ],
} as const;
