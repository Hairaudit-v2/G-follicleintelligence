import { AcademyMarketingView } from "@/components/academy/AcademyMarketingView";
import { ACADEMY_PAGE_METADATA } from "@/lib/marketing/academyPageContent";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: ACADEMY_PAGE_METADATA.title,
  description: ACADEMY_PAGE_METADATA.description,
  path: "/academy",
  imageAlt: "Follicle Intelligence — AcademyOS workforce training infrastructure",
});

export default function AcademyPage() {
  return <AcademyMarketingView />;
}