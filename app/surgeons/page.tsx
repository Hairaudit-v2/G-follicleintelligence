import { SurgeonsMarketingView } from "@/components/surgeons/SurgeonsMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

const PAGE_TITLE = "Become A World-Class Hair Restoration Surgeon | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Follicle Intelligence is the operating system for modern hair restoration surgeons: structured training, consultation and surgical workflows, SurgeryOS case intelligence, outcome review, HairAudit-aligned auditing, and continuous improvement—without generic practice tooling.";

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/surgeons",
  imageAlt:
    "Follicle Intelligence — surgical development and intelligence for hair restoration surgeons",
});

export default function SurgeonsPage() {
  return <SurgeonsMarketingView />;
}
