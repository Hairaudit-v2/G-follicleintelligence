import { WhyFollicleIntelligenceView } from "@/components/why/WhyFollicleIntelligenceView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Why Follicle Intelligence Exists",
  description:
    "Learn why Follicle Intelligence is building the infrastructure layer for the future of global hair restoration medicine.",
  path: "/why-follicle-intelligence",
  imageAlt: "Follicle Intelligence — why we exist",
});

export default function WhyFollicleIntelligencePage() {
  return <WhyFollicleIntelligenceView />;
}