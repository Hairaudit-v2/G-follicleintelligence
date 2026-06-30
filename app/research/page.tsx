import { ResearchMarketingView } from "@/components/research/ResearchMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Research | Follicle Intelligence",
  description:
    "Explore how Follicle Intelligence is building research infrastructure for evidence-based hair restoration medicine, outcome benchmarking, AI model development, and future clinical registries.",
  path: "/research",
  imageAlt: "Follicle Intelligence — research infrastructure for hair restoration medicine",
});

export default function ResearchPage() {
  return <ResearchMarketingView />;
}
