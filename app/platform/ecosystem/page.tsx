import { EcosystemArchitectureView } from "@/components/platform/EcosystemArchitectureView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { SITE_SEO_KEYWORDS } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Ecosystem Architecture | Connected OS For Hair Restoration | Follicle Intelligence",
  description:
    "How Follicle Intelligence connects clinical operations, surgical intelligence, business infrastructure, human infrastructure, and global intelligence into one healthcare operating system — acquisition, consultation, imaging, surgery, audit, workforce, training, finance, and analytics.",
  path: "/platform/ecosystem",
  keywords: [...SITE_SEO_KEYWORDS, "healthcare infrastructure stack", "ecosystem architecture"],
});

export default function EcosystemArchitecturePage() {
  return <EcosystemArchitectureView />;
}
