import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  tenantId: string;
  isConnected: boolean;
  pendingCount: number;
};

/**
 * Compact HubSpot status card for Clinic Settings / Configuration home.
 */
export function HubSpotSummaryCard({ tenantId, isConnected, pendingCount }: Props) {
  const tid = tenantId.trim();
  const inboxHref = `/fi-admin/${tid}/inbox`;
  const hubspotHref = `/fi-admin/${tid}/settings/integrations/hubspot`;

  return (
    <Card
      className="border-white/[0.08] bg-[#0F1629]/80 text-slate-100 shadow-lg shadow-black/30 backdrop-blur-md"
      data-testid="hubspot-summary-card"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium text-slate-50">HubSpot Integration</CardTitle>
        <Link2 className="h-4 w-4 text-slate-500" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={
                  isConnected
                    ? "border-0 bg-emerald-600 text-white hover:bg-emerald-600"
                    : "border-white/[0.08] bg-white/[0.06] text-slate-300"
                }
              >
                {isConnected ? "Connected" : "Not connected"}
              </Badge>
              <Link
                href={hubspotHref}
                className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
              >
                Manage
              </Link>
            </div>
            {pendingCount > 0 ? (
              <p className="text-sm text-slate-400">
                {pendingCount} lead{pendingCount === 1 ? "" : "s"} pending approval
              </p>
            ) : isConnected ? (
              <p className="text-sm text-slate-500">No leads waiting for approval</p>
            ) : (
              <p className="text-sm text-slate-500">Connect HubSpot to stage inbound leads</p>
            )}
          </div>

          {pendingCount > 0 ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="shrink-0 border-white/[0.12] bg-transparent text-slate-100 hover:bg-white/[0.06]"
            >
              <Link href={inboxHref}>
                Review
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
