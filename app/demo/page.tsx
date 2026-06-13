import type { Metadata } from "next";

import { FiMarketingPlaceholderPage } from "@/components/marketing/FiMarketingPlaceholderPage";
import { MARKETING_PLACEHOLDER_COPY } from "@/lib/marketing/marketingPlaceholderContent";

const c = MARKETING_PLACEHOLDER_COPY.demo;

export const metadata: Metadata = {
  title: c.title,
  description: c.description,
};

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
