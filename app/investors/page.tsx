import { InvestorsMarketingView } from "@/components/investors/InvestorsMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Investors | Follicle Intelligence",
  description:
    "Understand the long-term infrastructure opportunity behind Follicle Intelligence and the future of intelligence-driven hair restoration medicine.",
  path: "/investors",
  imageAlt: "Follicle Intelligence — institutional infrastructure for hair restoration medicine",
});

export default function InvestorsPage() {
  return <InvestorsMarketingView />;
}
