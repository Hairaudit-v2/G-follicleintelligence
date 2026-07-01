import { EcosystemArchitectureView } from "@/components/platform/EcosystemArchitectureView";
import {
  ECOSYSTEM_ARCHITECTURE_PAGE_LABEL,
  ECOSYSTEM_ARCHITECTURE_SEO_DESCRIPTION,
  ECOSYSTEM_ARCHITECTURE_SEO_TITLE,
} from "@/lib/marketing/ecosystemArchitecturePageContent";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: ECOSYSTEM_ARCHITECTURE_SEO_TITLE,
  description: ECOSYSTEM_ARCHITECTURE_SEO_DESCRIPTION,
  path: "/platform/ecosystem",
  imageAlt: `Follicle Intelligence — ${ECOSYSTEM_ARCHITECTURE_PAGE_LABEL}`,
  keywords: [
    ...SITE_SEO_KEYWORDS,
    "what makes follicle intelligence different",
    "vertical intelligence operating system",
    "hair restoration clinic software",
    "healthcare infrastructure stack",
    "clinical intelligence platform",
  ],
});

export default function EcosystemArchitecturePage() {
  return <EcosystemArchitectureView />;
}
