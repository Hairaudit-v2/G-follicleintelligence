/**
 * Follicle Intelligence Network — shared UI surface.
 * Import from `@/packages/ui` in this repository.
 */

export * from "./tokens";
export * from "./ecosystem";

export { NetworkButton, networkButtonVariants, type NetworkButtonProps } from "./Button";
export { NetworkCard, type NetworkCardProps, type NetworkCardVariant } from "./Card";
export { NetworkBadge, type NetworkBadgeProps, type NetworkBadgeTone } from "./Badge";
export { NetworkSection, type NetworkSectionProps } from "./Section";
export { NetworkContainer, type NetworkContainerProps } from "./Container";
export { Hero, type HeroProps } from "./Hero";
export { NetworkHero, type NetworkHeroProps } from "./NetworkHero";
export { NetworkFeatureGrid, type NetworkFeatureGridProps } from "./FeatureGrid";
export { NetworkFeatureCard, type NetworkFeatureCardProps } from "./FeatureCard";
export { NetworkMetricCard, type NetworkMetricCardProps } from "./MetricCard";
export { NetworkPlatformNav, type NetworkPlatformNavProps } from "./PlatformNav";
export { NetworkEcosystemFooter, type NetworkEcosystemFooterProps, type LegalLink } from "./EcosystemFooter";
export { NetworkProductPill, type NetworkProductPillProps } from "./ProductPill";
export { NetworkCTASection, type NetworkCTASectionProps } from "./CTASection";
export { NetworkLogoCloud, type NetworkLogoCloudProps, type NetworkLogoItem } from "./LogoCloud";
export { NetworkTestimonialCard, type NetworkTestimonialCardProps } from "./TestimonialCard";
export { NetworkPricingCard, type NetworkPricingCardProps, type NetworkPricingTier } from "./PricingCard";
export { NetworkStatBlock, type NetworkStatBlockProps } from "./StatBlock";
export { NetworkTimeline, type NetworkTimelineProps, type NetworkTimelineItem } from "./Timeline";
export { NetworkFAQAccordion, type NetworkFAQAccordionProps, type NetworkFaqItem } from "./FAQAccordion";

export { NetworkProblemSolutionSection, type NetworkProblemSolutionSectionProps, type ProblemSolutionColumn } from "./sections/ProblemSolutionSection";
export { NetworkIntelligenceLayerSection, type NetworkIntelligenceLayerSectionProps, type IntelligenceLayerItem } from "./sections/IntelligenceLayerSection";
export { NetworkEcosystemMapSection, type NetworkEcosystemMapSectionProps } from "./sections/EcosystemMapSection";
export { NetworkAudienceSection, type NetworkAudienceSectionProps, type AudienceSegment } from "./sections/AudienceSection";

/** Unprefixed aliases for ergonomic composition in host apps */
export { NetworkButton as Button } from "./Button";
export { NetworkCard as Card } from "./Card";
export { NetworkBadge as Badge } from "./Badge";
export { NetworkSection as Section } from "./Section";
export { NetworkContainer as Container } from "./Container";
export { NetworkFeatureGrid as FeatureGrid } from "./FeatureGrid";
export { NetworkFeatureCard as FeatureCard } from "./FeatureCard";
export { NetworkMetricCard as MetricCard } from "./MetricCard";
export { NetworkPlatformNav as PlatformNav } from "./PlatformNav";
export { NetworkEcosystemFooter as EcosystemFooter } from "./EcosystemFooter";
export { NetworkProductPill as ProductPill } from "./ProductPill";
export { NetworkCTASection as CTASection } from "./CTASection";
export { NetworkLogoCloud as LogoCloud } from "./LogoCloud";
export { NetworkTestimonialCard as TestimonialCard } from "./TestimonialCard";
export { NetworkPricingCard as PricingCard } from "./PricingCard";
export { NetworkStatBlock as StatBlock } from "./StatBlock";
export { NetworkTimeline as Timeline } from "./Timeline";
export { NetworkFAQAccordion as FAQAccordion } from "./FAQAccordion";
