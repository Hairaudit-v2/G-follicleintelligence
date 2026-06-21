import { EcosystemArchitectureView } from "@/components/platform/EcosystemArchitectureView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Ecosystem Architecture | Connected OS For Hair Restoration | Follicle Intelligence",
  description:
    "How Follicle Intelligence connects Growth, Clinical, Workforce, and Enterprise engines into one infrastructure layer — acquisition, consultation, imaging, surgery, audit, workforce, training, finance, and analytics.",
  path: "/platform/ecosystem",
});

export default function EcosystemArchitecturePage() {
  return <EcosystemArchitectureView />;
}
