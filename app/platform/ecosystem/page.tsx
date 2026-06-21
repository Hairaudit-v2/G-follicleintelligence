import type { Metadata } from "next";

import { EcosystemArchitectureView } from "@/components/platform/EcosystemArchitectureView";

export const metadata: Metadata = {
  title: "Ecosystem Architecture | Connected OS For Hair Restoration | Follicle Intelligence",
  description:
    "How Follicle Intelligence connects Growth, Clinical, Workforce, and Enterprise engines into one infrastructure layer — acquisition, consultation, imaging, surgery, audit, workforce, training, finance, and analytics.",
};

export default function EcosystemArchitecturePage() {
  return <EcosystemArchitectureView />;
}
