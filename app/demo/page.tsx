import { FiMarketingPlaceholderPage } from "@/components/marketing/FiMarketingPlaceholderPage";
import { MARKETING_PLACEHOLDER_COPY } from "@/lib/marketing/marketingPlaceholderContent";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

const c = MARKETING_PLACEHOLDER_COPY.demo;

export const metadata = buildPageMetadata({
  title: c.title,
  description: c.description,
  path: "/demo",
});

export default function DemoPage() {
  return (
    <FiMarketingPlaceholderPage
      eyebrow="Enterprise"
      headline={c.headline}
      description={c.description}
      variant="demo"
      comingNext={c.comingNext}
    />
  );
}
