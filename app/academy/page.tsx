import type { Metadata } from "next";

import { FiMarketingPlaceholderPage } from "@/components/marketing/FiMarketingPlaceholderPage";
import { MARKETING_PLACEHOLDER_COPY } from "@/lib/marketing/marketingPlaceholderContent";

const c = MARKETING_PLACEHOLDER_COPY.academy;

export const metadata: Metadata = {
  title: c.title,
  description: c.description,
};

export default function AcademyPage() {
  return <FiMarketingPlaceholderPage eyebrow="Academy" headline={c.headline} description={c.description} comingNext={c.comingNext} />;
}
