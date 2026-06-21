import { AuditNetworkMarketingView } from "@/components/audit-network/AuditNetworkMarketingView";
import { AUDIT_NETWORK_PAGE_METADATA } from "@/lib/marketing/auditNetworkPageContent";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: AUDIT_NETWORK_PAGE_METADATA.title,
  description: AUDIT_NETWORK_PAGE_METADATA.description,
  path: "/audit-network",
  imageAlt: "Follicle Intelligence — AuditOS independent outcome verification",
});

export default function AuditNetworkPage() {
  return <AuditNetworkMarketingView />;
}