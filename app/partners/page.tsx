import { PartnersMarketingView } from "@/components/partners/PartnersMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Strategic Partnerships | Follicle Intelligence",
  description:
    "Explore how clinics, educators, enterprise groups, and industry partners can help build the future of global hair restoration medicine.",
  path: "/partners",
  imageAlt: "Follicle Intelligence — strategic partnerships for hair restoration medicine",
});

export default function PartnersPage() {
  return <PartnersMarketingView />;
}