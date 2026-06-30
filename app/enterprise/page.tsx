import { EnterpriseMarketingView } from "@/components/enterprise/EnterpriseMarketingView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

const PAGE_TITLE = "Enterprise: Scale Globally Without Losing Quality | Follicle Intelligence";

const PAGE_DESCRIPTION =
  "Enterprise infrastructure for multi-clinic groups, international networks, franchises, training organisations, and serious operators: standardised workflows, governance, training visibility, outcome monitoring, and portfolio analytics—without generic practice tooling.";

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/enterprise",
  imageAlt: "Follicle Intelligence — enterprise infrastructure for hair restoration",
});

export default function EnterprisePage() {
  return <EnterpriseMarketingView />;
}
